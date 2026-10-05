import { useRef, useState, type DragEvent } from "react";
import {
  Check,
  Copy,
  Download,
  FileText,
  ImageUp,
  Loader2,
  MessageCircle,
  RotateCw,
  Share2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { moods, occasions, recipients, refinements, visualStyles } from "@/domain/content";
import { samplePhotos } from "@/domain/samples";
import { fallbackMessage, type MessageRequest } from "@/domain/services/message-writer";
import { writeMessages } from "@/lib/message-ai";
import { shareCard } from "./shareCard";
import { downloadCard, downloadCardPdf } from "./exportCard";
import { CardPreview } from "./CardPreview";
import { TextControls } from "./TextControls";
import { RatioSelector } from "./RatioSelector";
import { PhotoLibrary } from "./PhotoLibrary";
import { ArtworkGenerator } from "./ArtworkGenerator";
import { PrintHandoff } from "./PrintHandoff";
import { usePrintNotice } from "./print-notice";
import { artworkKey } from "@/lib/art-style";
import { useStore } from "./creation-store";
import type {
  CreationDraft,
  MoodId,
  OccasionId,
  RecipientId,
  StyleId,
} from "@/domain/entities/types";
import { cn } from "@/lib/utils";
import styleOriginal from "@/assets/style-original.jpg";
import styleWatercolor from "@/assets/style-watercolor.jpg";
import styleOil from "@/assets/style-oil.jpg";
import styleSketch from "@/assets/style-sketch.jpg";
import styleImpressionist from "@/assets/style-impressionist.jpg";
import styleVanGogh from "@/assets/style-vangogh.jpg";
import stylePicasso from "@/assets/style-picasso.jpg";
import styleWarhol from "@/assets/style-warhol.jpg";
import styleDaVinci from "@/assets/style-davinci.jpg";
import styleMonet from "@/assets/style-monet.jpg";
import styleCartoon from "@/assets/style-cartoon.jpg";
import styleAiCharacter from "@/assets/style-ai-character.jpg";

const ACCEPTED = "image/jpeg,image/png,image/heic,image/heif,image/webp";
const MAX_BYTES = 25 * 1024 * 1024;

const stylePreviews: Partial<Record<StyleId, string>> = {
  original: styleOriginal,
  watercolor: styleWatercolor,
  pointillist: styleOil,
  "pop-art": styleSketch,
  impressionist: styleImpressionist,
  vangogh: styleVanGogh,
  picasso: stylePicasso,
  warhol: styleWarhol,
  davinci: styleDaVinci,
  monet: styleMonet,
  cartoon: styleCartoon,
  "ai-character": styleAiCharacter,
};

const relationshipChips: RecipientId[] = [
  "partner",
  "mum",
  "dad",
  "friend",
  "child",
  "sister",
  "brother",
  "grandma",
  "someone-special",
];
const occasionChips: OccasionId[] = [
  "birthday",
  "anniversary",
  "thank-you",
  "thinking-of-you",
  "sympathy",
  "congratulations",
];
const moodChips: MoodId[] = ["warm", "humorous", "poetic", "sincere"];

type TabId = "photo" | "words" | "style";

const tabs: { id: TabId; label: string }[] = [
  { id: "photo", label: "Photo" },
  { id: "words", label: "Message" },
  { id: "style", label: "Art" },
];

const freshPhotoState: Partial<CreationDraft> = {
  styleId: "original",
  styleJobStatus: "complete",
  artworkRenders: {},
  imageRotation: 0,
  imagePan: { x: 0, y: 0 },
  imageZoom: 1,
};

function Chips<T extends string>({
  label,
  items,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  items: { id: T; label: string }[];
  value: string | null | undefined;
  onChange: (id: T) => void;
  compact?: boolean;
}) {
  if (!compact) {
    return (
      <div>
        <p className="px-1 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={value === item.id}
              onClick={() => onChange(item.id)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[14px] transition-colors",
                value === item.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/40",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  // Compact: one horizontally scrolling row per group — mobile-sized.
  return (
    <div className="flex items-center gap-2">
      <p className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="scrollbar-none flex flex-1 snap-x gap-1.5 overflow-x-auto px-0.5 pb-0.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={value === item.id}
            onClick={() => onChange(item.id)}
            className={cn(
              "shrink-0 snap-start rounded-full border px-2.5 py-1 text-[13px] transition-colors",
              value === item.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-primary/40",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A single calm screen: see the card, change one thing at a time, send it. */
export function QuickCreate() {
  const { draft, updateDraft } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<TabId>("photo");
  const [writing, setWriting] = useState<string | null>(null);
  const [messageOptions, setMessageOptions] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const confirmed = Boolean(draft.rightsConfirmedAt);

  // Live summary of what shapes the AI message — proves the options above matter.
  const contextBits = [
    draft.recipientNickname.trim() ||
      (draft.relationship !== "unspecified"
        ? (recipients.find((r) => r.id === draft.relationship)?.label ?? null)
        : null),
    draft.occasion !== "unspecified"
      ? (occasions.find((o) => o.id === draft.occasion)?.label ?? null)
      : null,
    draft.mood !== "unspecified" ? (moods.find((m) => m.id === draft.mood)?.label ?? null) : null,
  ].filter((bit): bit is string => Boolean(bit));

  function setConfirmed(checked: boolean) {
    updateDraft({ rightsConfirmedAt: checked ? new Date().toISOString() : null });
  }

  function openPicker() {
    if (!confirmed) {
      toast.error("Confirm the photo is yours to use first.");
      return;
    }
    inputRef.current?.click();
  }

  function readFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose a photo file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("That photo is larger than 25 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => toast.error("We couldn't read that file.");
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new window.Image();
      img.onload = () => {
        updateDraft({
          photo: {
            dataUrl,
            sampleId: null,
            fileName: file.name,
            widthPx: img.naturalWidth,
            heightPx: img.naturalHeight,
          },
          title: draft.title === "Untitled" ? file.name.replace(/\.[^.]+$/, "") : draft.title,
          ...freshPhotoState,
        });
        setTab("words");
      };
      img.onerror = () => toast.error("We couldn't open that image.");
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (!confirmed) setConfirmed(true);
    readFile(file);
  }

  function selectStockPhoto(photo: { src: string; label: string; width: number; height: number }) {
    updateDraft({
      photo: {
        dataUrl: photo.src,
        sampleId: `library-${photo.label}`,
        fileName: null,
        widthPx: photo.width,
        heightPx: photo.height,
      },
      title: photo.label,
      ...freshPhotoState,
    });
    toast.success(`${photo.label} photo added.`);
  }

  function request(): MessageRequest {
    return {
      recipientNickname: draft.recipientNickname,
      relationship: draft.relationship,
      occasion: draft.occasion,
      mood: draft.mood,
      memory: draft.memory,
      senderName: draft.senderName,
      language: draft.language,
    };
  }

  async function generateMessage() {
    setWriting("write");
    try {
      const current = draft.message.trim();
      const options = current
        ? await writeMessages(request(), { refinement: "", current })
        : await writeMessages(request());
      // Server returns up to 3 short (≤160 chars) options. When the user left
      // the box empty, fill the first one in; when they already wrote
      // something, keep their text until they tap an option.
      setMessageOptions(options);
      if (!current) updateDraft({ message: options[0] ?? fallbackMessage(request()) });
      else toast.success("AI suggestions ready — tap one to use it, or keep yours.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn't write a message.";
      if (/not configured/i.test(message)) {
        toast.error("AI messages need GEMINI_API_KEY in .env — you can still type your own.");
      } else {
        toast.error(message);
      }
    } finally {
      setWriting(null);
    }
  }

  async function refine(refinement: string) {
    if (!draft.message.trim()) {
      toast.error("Write or generate a message first.");
      return;
    }
    setWriting(refinement);
    try {
      const options = await writeMessages(request(), { refinement, current: draft.message });
      if (options[0]) updateDraft({ message: options[0] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't refine the message.");
    } finally {
      setWriting(null);
    }
  }

  const { requestPrintGoAhead, dialog: printNoticeDialog } = usePrintNotice();

  async function runExport(kind: "png" | "pdf") {
    if (kind === "pdf" && !(await requestPrintGoAhead(draft))) return;
    setExporting(kind);
    try {
      if (kind === "png") await downloadCard(draft);
      else await downloadCardPdf(draft);
      toast.success(kind === "png" ? "High-resolution image saved." : "Print-ready PDF saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the card.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {printNoticeDialog}
      <header className="sticky top-0 z-40 border-b border-white/20 bg-gradient-to-b from-primary/15 via-background/70 to-background/60 shadow-[0_8px_32px_rgb(86_60_20/0.12)] backdrop-blur-xl">
        <div className="mx-auto flex h-[52px] w-full max-w-5xl items-center justify-center px-4">
          <span className="brand-title text-[30px] font-bold leading-none text-primary">
            Dearly Studio
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-32 pt-3">
        <div
          role="tablist"
          aria-label="What to change"
          className="mx-auto mb-4 grid w-full max-w-xl grid-cols-3 rounded-full bg-muted p-1"
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "rounded-full py-2 text-[15px] font-medium transition-colors",
                tab === item.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="md:grid md:grid-cols-[minmax(0,360px)_1fr] md:items-start md:gap-8">
          <div className="mx-auto w-full max-w-[320px] md:sticky md:top-20 md:mx-0 md:max-w-none">
            <div
              className="relative mx-auto"
              style={{ maxWidth: draft.ratioId === "story" ? 240 : undefined }}
            >
              <CardPreview
                draft={draft}
                className="overflow-hidden rounded-2xl shadow-lg"
                onTextMove={(textCoordinates) => updateDraft({ textCoordinates })}
                onImageChange={(patch) => updateDraft(patch)}
              />
              {draft.photo ? (
                <button
                  type="button"
                  aria-label="Rotate photo 90 degrees"
                  title="Rotate photo"
                  onClick={() =>
                    updateDraft({
                      imageRotation: (((draft.imageRotation ?? 0) + 90) %
                        360) as CreationDraft["imageRotation"],
                    })
                  }
                  className="absolute right-2 top-2 z-20 grid size-9 place-items-center rounded-full bg-background/80 text-foreground shadow-md backdrop-blur transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RotateCw className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <RatioSelector value={draft.ratioId} onChange={(ratioId) => updateDraft({ ratioId })} />
            {draft.photo ? (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Drag the photo to frame it · pinch or scroll to zoom · drag the message to move it
              </p>
            ) : null}
          </div>

          <div className="mt-6 md:mt-0">
            {tab === "photo" ? (
              <section className="space-y-4">
                <div className="rounded-2xl border border-border bg-card">
                  <label className="flex items-center justify-between gap-4 p-4">
                    <span className="min-w-0 text-[15px]">
                      This photo is mine to use
                      <span className="mt-0.5 block text-[13px] text-muted-foreground">
                        We only keep it to make your card.
                      </span>
                    </span>
                    <Switch
                      checked={confirmed}
                      onCheckedChange={(v) => setConfirmed(v === true)}
                      aria-label="This photo is mine to use"
                    />
                  </label>
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED}
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) readFile(file);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={openPicker}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={cn(
                    "flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors",
                    dragging
                      ? "border-primary bg-accent/40"
                      : "border-border bg-card hover:border-primary/50",
                  )}
                >
                  <ImageUp className="size-6 text-primary" aria-hidden="true" />
                  <span className="text-[16px] font-medium">Choose a photo</span>
                  <span className="text-[13px] text-muted-foreground">or drop it here</span>
                </button>

                <PhotoLibrary
                  onSelect={selectStockPhoto}
                  triggerLabel="Choose from Library"
                  triggerVariant="outline"
                  triggerClassName="w-full justify-center rounded-xl py-3 text-[15px]"
                />

                <div>
                  <p className="px-1 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
                    Or try one of ours
                  </p>
                  <ul className="mt-2 grid grid-cols-4 gap-2">
                    {samplePhotos.map((sample) => (
                      <li key={sample.id}>
                        <button
                          type="button"
                          onClick={() =>
                            updateDraft({
                              photo: {
                                dataUrl: sample.src,
                                sampleId: sample.id,
                                fileName: null,
                                widthPx: sample.widthPx,
                                heightPx: sample.heightPx,
                              },
                              title: sample.label,
                              ...freshPhotoState,
                            })
                          }
                          className={cn(
                            "relative block w-full overflow-hidden rounded-xl ring-2 transition",
                            draft.photo?.sampleId === sample.id
                              ? "ring-primary"
                              : "ring-transparent",
                          )}
                        >
                          <img
                            src={sample.src}
                            alt={sample.label}
                            loading="lazy"
                            className="aspect-square w-full object-cover"
                          />
                          {draft.photo?.sampleId === sample.id ? (
                            <span className="absolute bottom-1 right-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                              <Check className="size-3" aria-hidden="true" />
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ) : null}

            {tab === "words" ? (
              <section className="space-y-4">
                <div className="space-y-2.5 rounded-2xl border border-border bg-card/60 p-3">
                  <Chips
                    compact
                    label="Who"
                    items={relationshipChips.map((id) => ({
                      id,
                      label: recipients.find((r) => r.id === id)?.label ?? id,
                    }))}
                    value={draft.relationship}
                    onChange={(relationship) => updateDraft({ relationship })}
                  />
                  <Chips
                    compact
                    label="When"
                    items={occasionChips.map((id) => ({
                      id,
                      label: occasions.find((o) => o.id === id)?.label ?? id,
                    }))}
                    value={draft.occasion}
                    onChange={(occasion) => updateDraft({ occasion })}
                  />
                  <Chips
                    compact
                    label="Mood"
                    items={moodChips.map((id) => ({
                      id,
                      label: moods.find((m) => m.id === id)?.label ?? id,
                    }))}
                    value={draft.mood}
                    onChange={(mood) => updateDraft({ mood })}
                  />
                  <label className="block">
                    <span className="sr-only">Their name</span>
                    <Input
                      value={draft.recipientNickname}
                      onChange={(e) => updateDraft({ recipientNickname: e.target.value })}
                      placeholder="Their name"
                      className="h-10 rounded-xl"
                    />
                  </label>
                  <details className="group rounded-xl">
                    <summary className="tap-safe flex cursor-pointer list-none items-center gap-1.5 px-1 py-1 text-[13px] font-medium text-primary [&::-webkit-details-marker]:hidden">
                      <span
                        aria-hidden="true"
                        className="grid size-5 shrink-0 place-items-center rounded-full border border-primary/40 text-[15px] leading-none"
                      >
                        <span className="group-open:hidden">+</span>
                        <span className="hidden group-open:inline">–</span>
                      </span>
                      {draft.senderName || draft.memory
                        ? "Names & memory ✓"
                        : "Names & memory (optional)"}
                    </summary>
                    <div className="grid gap-2 pb-1 sm:grid-cols-2">
                      <label className="block">
                        <span className="sr-only">Your name</span>
                        <Input
                          value={draft.senderName}
                          onChange={(e) => updateDraft({ senderName: e.target.value })}
                          placeholder="Your name"
                          className="h-10 rounded-xl"
                        />
                      </label>
                      <label className="block">
                        <span className="sr-only">A memory</span>
                        <Input
                          value={draft.memory}
                          onChange={(e) => updateDraft({ memory: e.target.value })}
                          placeholder="e.g. our beach trip"
                          className="h-10 rounded-xl"
                        />
                      </label>
                    </div>
                  </details>
                </div>
                <p
                  className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-center text-[13px] text-foreground"
                  aria-live="polite"
                >
                  {contextBits.length ? (
                    <>
                      AI writes for <strong>{contextBits.join(" · ")}</strong>
                    </>
                  ) : (
                    "Add details above for a personal touch"
                  )}
                </p>
                <div>
                  <label className="block">
                    <span className="px-1 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
                      Your message
                    </span>
                    <Textarea
                      value={draft.message}
                      onChange={(e) => {
                        updateDraft({ message: e.target.value });
                        setMessageOptions([]);
                      }}
                      placeholder="Write a line for them… or leave blank and let AI draft one."
                      className="mt-1.5 min-h-32 rounded-2xl border-border bg-card p-4 text-[16px]"
                      aria-label="Your message"
                    />
                  </label>
                  <p className="mt-1 px-1 text-xs text-muted-foreground">
                    Keep yours as-is, or tap Generate — AI will correct what you wrote, or draft one
                    from the details above. Short: 1–2 sentences.
                  </p>
                </div>
                <Button
                  type="button"
                  className="tap-safe h-11 w-full rounded-xl text-[15px]"
                  onClick={generateMessage}
                  disabled={Boolean(writing)}
                >
                  {writing === "write" ? (
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Wand2 className="mr-2 size-4" aria-hidden="true" />
                  )}
                  {writing === "write"
                    ? "Writing…"
                    : draft.message.trim()
                      ? "Improve it with AI"
                      : "Generate with AI"}
                </Button>
                {messageOptions.length > 0 ? (
                  <ul className="space-y-2" aria-live="polite">
                    {messageOptions.map((option, i) => (
                      <li key={`${i}-${option.slice(0, 24)}`}>
                        <button
                          type="button"
                          onClick={() => updateDraft({ message: option })}
                          className={cn(
                            "w-full rounded-xl border-2 p-3 text-left text-[15px] transition-colors",
                            draft.message === option
                              ? "border-primary bg-accent/40"
                              : "border-border bg-card hover:border-primary/40",
                          )}
                        >
                          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {i === 0 && draft.message.trim()
                              ? "Corrected yours"
                              : `Option ${i + 1}`}
                          </span>
                          <span className="block whitespace-pre-line">{option}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {refinements.map((item) => (
                    <Button
                      key={item}
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="rounded-full"
                      disabled={Boolean(writing) || !draft.message.trim()}
                      onClick={() => refine(item)}
                    >
                      {writing === item ? (
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
                      ) : null}
                      {item}
                    </Button>
                  ))}
                </div>
              </section>
            ) : null}

            {tab === "style" ? (
              <section className="space-y-6">
                <div>
                  <p className="px-1 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
                    Artistic styles
                  </p>
                  <div className="-mx-4 mt-2 grid snap-x snap-mandatory auto-cols-[40%] grid-flow-col gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid-flow-row sm:grid-cols-3 sm:overflow-visible sm:px-0">
                    {visualStyles.map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => {
                          if (!draft.photo && style.id !== "original") {
                            toast.error("Add a photo first.");
                            return;
                          }
                          updateDraft({
                            styleId: style.id,
                            styleJobStatus:
                              style.id === "original" ||
                              Boolean(
                                draft.artworkRenders?.[artworkKey(style.id, draft.styleIntensity)],
                              )
                                ? "complete"
                                : "queued",
                          });
                        }}
                        aria-pressed={draft.styleId === style.id}
                        className={cn(
                          "relative snap-start overflow-hidden rounded-xl bg-card text-left ring-2 transition",
                          draft.styleId === style.id ? "ring-primary" : "ring-border",
                        )}
                      >
                        <img
                          src={stylePreviews[style.id] ?? styleOriginal}
                          alt=""
                          loading="lazy"
                          className="aspect-square w-full object-cover"
                        />
                        {draft.styleId === style.id ? (
                          <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
                            <Check className="size-3.5" aria-hidden="true" />
                          </span>
                        ) : null}
                        <span className="block min-h-14 px-2.5 py-2">
                          <span className="block text-[13px] font-semibold">{style.label}</span>
                          <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4 text-muted-foreground">
                            {style.description}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <ArtworkGenerator draft={draft} update={updateDraft} />
                </div>

                <TextControls draft={draft} update={updateDraft} />
              </section>
            ) : null}
          </div>
        </div>
      </main>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 p-3 backdrop-blur">
        <div className="mx-auto w-full max-w-5xl">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="lg" className="tap-safe h-12 w-full rounded-xl text-[16px]">
                <Share2 className="mr-2 size-5" aria-hidden="true" />
                Send it
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl">
              <SheetHeader className="text-left">
                <SheetTitle>Send it</SheetTitle>
              </SheetHeader>
              <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                <li>
                  <button
                    type="button"
                    onClick={() => void shareCard(draft, "whatsapp")}
                    className="flex w-full items-center gap-3 p-4 text-left text-[16px]"
                  >
                    <MessageCircle className="size-5 text-primary" aria-hidden="true" />
                    WhatsApp
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => void shareCard(draft, "any")}
                    className="flex w-full items-center gap-3 p-4 text-left text-[16px]"
                  >
                    <Share2 className="size-5 text-primary" aria-hidden="true" />
                    Share another way
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    disabled={Boolean(exporting)}
                    onClick={() => void runExport("png")}
                    className="flex w-full items-center gap-3 p-4 text-left text-[16px]"
                  >
                    {exporting === "png" ? (
                      <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
                    ) : (
                      <Download className="size-5 text-primary" aria-hidden="true" />
                    )}
                    Save high-res image
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    disabled={Boolean(exporting)}
                    onClick={() => void runExport("pdf")}
                    className="flex w-full items-center gap-3 p-4 text-left text-[16px]"
                  >
                    {exporting === "pdf" ? (
                      <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
                    ) : (
                      <FileText className="size-5 text-primary" aria-hidden="true" />
                    )}
                    Save print-ready PDF
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(draft.message || draft.title);
                      toast.success("Message copied.");
                    }}
                    className="flex w-full items-center gap-3 p-4 text-left text-[16px]"
                  >
                    <Copy className="size-5 text-primary" aria-hidden="true" />
                    Copy the words
                  </button>
                </li>
              </ul>
              <PrintHandoff draft={draft} />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}
