import { useRef, useState, type DragEvent } from "react";
import { Link } from "@tanstack/react-router";
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
  User as UserIcon,
  Calendar as CalendarIcon,
  ChevronLeft,
  Grid,
  Plus,
  Minus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Logo } from "@/components/layout/Logo";
import { useAuth } from "@/features/auth/auth-context";
import {
  intensityLabels,
  moods,
  occasions,
  recipients,
  refinements,
  visualStyles,
} from "@/domain/content";
import { samplePhotos } from "@/domain/samples";
import { AppHeader } from "@/components/layout/AppHeader";
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
import { artworkKey } from "@/lib/art-style";
import { useGenerationLimit, notifyLimitReached } from "@/domain/services/generation-limit";
import { useStore } from "./creation-store";
import type {
  CreationDraft,
  MoodId,
  OccasionId,
  RecipientId,
  StyleId,
  StyleIntensity,
} from "@/domain/entities/types";
import { cn } from "@/lib/utils";
import styleOriginal from "@/assets/style-original.jpg";
import styleImpressionist from "@/assets/style-impressionist.jpg";
import styleWatercolor from "@/assets/style-watercolor.jpg";
import styleOilPainting from "@/assets/style-oil.jpg";
import stylePencil from "@/assets/style-sketch.jpg";
import styleVanGogh from "@/assets/style-vangogh.jpg";
import stylePicasso from "@/assets/style-picasso.jpg";
import styleWarhol from "@/assets/style-warhol.jpg";
import styleDaVinci from "@/assets/style-davinci.jpg";
import styleMonet from "@/assets/style-monet.jpg";
import styleCartoon from "@/assets/style-cartoon.jpg";
import styleAiCharacter from "@/assets/style-ai-character.jpg";

const stylePreviews: Record<string, string> = {
  original: styleOriginal,
  impressionist: styleImpressionist,
  watercolor: styleWatercolor,
  pointillist: styleOilPainting,
  "pop-art": stylePencil,
  vangogh: styleVanGogh,
  picasso: stylePicasso,
  warhol: styleWarhol,
  davinci: styleDaVinci,
  monet: styleMonet,
  cartoon: styleCartoon,
  "ai-character": styleAiCharacter,
};

const ACCEPTED = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const MAX_BYTES = 25 * 1024 * 1024;

type StepId = 1 | 2 | 3;

const freshPhotoState: Partial<CreationDraft> = {
  styleId: "original",
  styleJobStatus: "complete",
  artworkRenders: {},
  imageRotation: 0,
  imagePan: { x: 0, y: 0 },
  imageZoom: 1,
};

const quickStarters = [
  "Thank you for every ordinary day that felt special.",
  "Happy birthday! Wishing you the happiest year ahead.",
  "Thinking of you and sending so much love today.",
  "So proud of you and everything you've accomplished.",
];

export function QuickCreate() {
  const { user } = useAuth();
  const { status: genStatus } = useGenerationLimit(user?.id);
  const { draft, updateDraft } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [writing, setWriting] = useState<string | null>(null);
  const [messageOptions, setMessageOptions] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [inspirationOpen, setInspirationOpen] = useState(false);
  const [samplesOpen, setSamplesOpen] = useState(false);

  // Send & schedule dialog state
  const [sendRecipient, setSendRecipient] = useState("Mum");
  const [whenMode, setWhenMode] = useState<"now" | "schedule">("now");
  const [scheduledDay, setScheduledDay] = useState(24);
  const [repeatYearly, setRepeatYearly] = useState(true);

  const confirmed = Boolean(draft.rightsConfirmedAt);

  function setConfirmed(checked: boolean) {
    updateDraft({ rightsConfirmedAt: checked ? new Date().toISOString() : null });
  }

  function openPicker() {
    if (!confirmed) {
      setConfirmed(true);
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
        toast.success("Photo added!");
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
    toast.success(`${photo.label} photo selected.`);
  }

  function request(): MessageRequest {
    return {
      recipientNickname: draft.recipientNickname,
      relationship: draft.relationship,
      occasion: draft.occasion,
      mood: draft.mood,
      memory: draft.memory,
      senderName: draft.senderName,
      language: "en",
    };
  }

  async function generateMessage() {
    setWriting("write");
    try {
      const messages = await writeMessages(
        request(),
        draft.message.trim()
          ? { refinement: "Improve wording and flow", current: draft.message.trim() }
          : undefined,
      );
      const first = messages[0];
      if (first) {
        updateDraft({ message: first });
        setMessageOptions(messages);
        toast.success(draft.message.trim() ? "Wording improved!" : "Draft generated!");
      }
    } catch {
      const fb = fallbackMessage(request());
      updateDraft({ message: fb });
      setMessageOptions([fb]);
    } finally {
      setWriting(null);
    }
  }

  async function refine(direction: string) {
    if (!draft.message.trim()) return;
    setWriting(direction);
    try {
      const messages = await writeMessages(request(), {
        refinement: direction,
        current: draft.message,
      });
      const first = messages[0];
      if (first) {
        updateDraft({ message: first });
        setMessageOptions([]);
        toast.success(`Message refined (${direction}).`);
      }
    } catch {
      toast.error("Couldn't refine message right now.");
    } finally {
      setWriting(null);
    }
  }

  async function runExport(kind: "png" | "pdf") {
    setExporting(kind);
    try {
      if (kind === "png") {
        await downloadCard(draft);
      } else {
        await downloadCardPdf(draft);
      }
      toast.success(kind === "png" ? "Card image downloaded" : "Print-ready PDF downloaded");
    } catch {
      toast.error("Could not export card. Please try again.");
    } finally {
      setExporting(null);
    }
  }

  const stepLabels: Record<StepId, string> = {
    1: "Photo",
    2: "Message",
    3: "Art",
  };

  const hasPhoto = Boolean(draft.photo);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-[#FBF5EE] text-[#2A1F22] selection:bg-[#9E2B57]/15">
      {/* Header matching Redesign: Brand on left, Step indicator on right */}
      <AppHeader
        trailing={
          <span className="text-sm font-semibold text-[#6B5A5E]">Step {currentStep} of 3</span>
        }
      />

      {/* Live Preview Stage matching Redesign (Screen 1 & 3) */}
      <section
        aria-label="Card preview"
        className="mx-4 flex shrink-0 items-center justify-center rounded-[24px] bg-[#F3E6DA] p-3 sm:p-4 shadow-sm"
      >
        <div className="relative mx-auto w-full max-w-[300px]">
          <CardPreview
            draft={draft}
            className="overflow-hidden rounded-2xl shadow-[0_8px_20px_rgba(42,31,34,0.12)] border-2 border-white/80"
            onTextMove={(textCoordinates) => updateDraft({ textCoordinates })}
            onImageChange={(patch) => updateDraft(patch)}
          />
          {draft.photo ? (
            <button
              type="button"
              aria-label="Rotate photo 90 degrees"
              onClick={() =>
                updateDraft({
                  imageRotation: (((draft.imageRotation ?? 0) + 90) %
                    360) as CreationDraft["imageRotation"],
                })
              }
              className="absolute right-2 top-2 z-20 grid size-8 place-items-center rounded-full bg-white/90 text-[#2A1F22] shadow-md backdrop-blur transition hover:bg-white"
            >
              <RotateCw className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </section>

      {/* Stepper Navigation Pills matching Redesign */}
      <nav aria-label="Steps" className="flex shrink-0 gap-2 px-4 pt-3 pb-1">
        {[1, 2, 3].map((stepNum) => {
          const s = stepNum as StepId;
          const isActive = currentStep === s;
          const isDone = currentStep > s || (s === 1 && hasPhoto);

          return (
            <button
              key={s}
              type="button"
              onClick={() => setCurrentStep(s)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 min-h-[42px] rounded-full border text-sm font-semibold transition-all",
                isActive
                  ? "bg-[#9E2B57] text-white border-[#9E2B57] shadow-sm font-bold"
                  : isDone
                    ? "bg-[#FAF7F2] text-[#2A1F22] border-[#E2D2C5] hover:border-[#C9A9A0]"
                    : "bg-[#FBF5EE] text-[#6B5A5E] border-[#E2D2C5]/70",
              )}
            >
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full text-xs font-bold leading-none",
                  isActive
                    ? "bg-white/20 text-white"
                    : isDone
                      ? "bg-[#9E2B57] text-white"
                      : "bg-[#E2D2C5] text-[#6B5A5E]",
                )}
              >
                {isDone && !isActive ? "✓" : s}
              </span>
              <span>{stepLabels[s]}</span>
            </button>
          );
        })}
      </nav>

      {/* Step Content */}
      <main className="flex-1 px-4 py-3 flex flex-col gap-4 overflow-y-auto">
        {/* STEP 1: PHOTO */}
        {currentStep === 1 && (
          <div className="flex flex-col gap-4">
            {/* CARD SHAPE: first choice, drawn at true proportions */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6B5A5E]">
                Card shape
              </span>
              <RatioSelector
                value={draft.ratioId}
                onChange={(ratioId) => updateDraft({ ratioId })}
              />
            </div>

            {/* Top 2 Buttons: Choose a photo & Dearly library */}
            <div className="grid grid-cols-2 gap-2.5">
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
                  "flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed p-2 text-center transition-all bg-white",
                  dragging
                    ? "border-[#9E2B57] bg-[#F3E6DA]"
                    : "border-[#C9A9A0] hover:border-[#9E2B57]",
                )}
              >
                <ImageUp className="size-5 text-[#9E2B57]" aria-hidden="true" />
                <span className="text-[15px] font-bold text-[#2A1F22]">Choose a photo</span>
              </button>

              <PhotoLibrary
                onSelect={selectStockPhoto}
                triggerLabel="Dearly library"
                triggerClassName="flex min-h-[88px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-[#E2D2C5] bg-white p-2 text-center text-[#2A1F22] hover:border-[#C9A9A0] transition-all"
                customTrigger={
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <Grid className="size-5 text-[#9E2B57]" aria-hidden="true" />
                    <span className="text-[15px] font-bold">Dearly library</span>
                  </div>
                }
              />
            </div>

            {/* Consent Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-[#E2D2C5] bg-white px-3.5 py-2.5">
              <label className="text-xs leading-snug cursor-pointer select-none">
                <strong className="block font-semibold text-[#2A1F22]">
                  This photo is mine to use.
                </strong>
                <span className="text-[#6B5A5E]">We only keep it to make your card.</span>
              </label>
              <Switch
                checked={confirmed}
                onCheckedChange={setConfirmed}
                aria-label="Confirm photo rights"
              />
            </div>

            {/* SAMPLE IMAGES: expandable */}
            <div className="flex flex-col rounded-2xl border border-[#E2D2C5] bg-white overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => setSamplesOpen((prev) => !prev)}
                aria-expanded={samplesOpen}
                className="flex w-full items-center justify-between p-3.5 text-left hover:bg-[#FAF7F2] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6B5A5E]">
                    Or start with a sample
                  </span>
                  <span className="text-[11px] font-medium text-[#6B5A5E]/70">
                    ({samplePhotos.length} images)
                  </span>
                </div>
                <div className="flex size-6 items-center justify-center rounded-full bg-[#F3E6DA] text-[#9E2B57]">
                  {samplesOpen ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
                </div>
              </button>

              {samplesOpen && (
                <div className="grid grid-cols-2 gap-2.5 border-t border-[#F3E6DA]/70 bg-[#FAF7F2]/40 p-3">
                  {samplePhotos.map((sample) => {
                    const isSelected = draft.photo?.sampleId === sample.id;
                    return (
                      <button
                        key={sample.id}
                        type="button"
                        aria-pressed={isSelected}
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
                          "flex flex-col overflow-hidden rounded-2xl border-[1.5px] bg-white text-left transition-all",
                          isSelected
                            ? "border-[#9E2B57] ring-2 ring-[#9E2B57]/30 shadow-sm"
                            : "border-[#E2D2C5] hover:border-[#C9A9A0]",
                        )}
                      >
                        <img
                          src={sample.src}
                          alt={sample.label}
                          loading="lazy"
                          className="aspect-[4/3] w-full object-cover"
                        />
                        <span className="truncate p-2 text-[12px] font-semibold text-[#2A1F22]">
                          {sample.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: MESSAGE */}
        {currentStep === 2 && (
          <div className="flex flex-col gap-4">
            {/* Your Message */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="card-msg" className="text-sm font-bold text-[#2A1F22]">
                Your message
              </label>
              <Textarea
                id="card-msg"
                rows={4}
                maxLength={140}
                value={draft.message}
                onChange={(e) => {
                  updateDraft({ message: e.target.value });
                  setMessageOptions([]);
                }}
                placeholder="Happy birthday, Mum. Thank you for every ordinary Sunday that felt like a holiday."
                className="rounded-2xl border-[1.5px] border-[#C9A9A0] bg-white p-3.5 text-base text-[#2A1F22] focus-visible:border-[#9E2B57] focus-visible:ring-1 focus-visible:ring-[#9E2B57] resize-none"
              />
              <div className="text-right text-xs font-medium text-[#6B5A5E]">
                {draft.message.length} / 140
              </div>
            </div>

            {/* Signed */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="card-sign" className="text-sm font-bold text-[#2A1F22]">
                Signed
              </label>
              <Input
                id="card-sign"
                value={draft.senderName}
                onChange={(e) => updateDraft({ senderName: e.target.value })}
                placeholder="With love"
                className="h-12 rounded-xl border-[1.5px] border-[#C9A9A0] bg-white text-base"
              />
            </div>

            {/* Ideas / Mood pills matching 3 Message.png */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6B5A5E]">
                Ideas
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "heartfelt", label: "Warm" },
                  { id: "funny", label: "Funny" },
                  { id: "poetic", label: "Short" },
                  { id: "formal", label: "Formal" },
                ].map((m) => {
                  const isSel = draft.mood === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        updateDraft({ mood: m.id as MoodId });
                        void generateMessage();
                      }}
                      className={cn(
                        "min-h-[40px] px-4 rounded-full border text-sm font-semibold transition-all",
                        isSel
                          ? "bg-[#9E2B57] text-white border-[#9E2B57] font-bold"
                          : "bg-white text-[#2A1F22] border-[#E2D2C5] hover:border-[#C9A9A0]",
                      )}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Starters / Suggested messages - Expandable with + button */}
            <div className="flex flex-col rounded-2xl border border-[#E2D2C5] bg-white overflow-hidden transition-all shadow-2xs">
              <button
                type="button"
                onClick={() => setInspirationOpen((prev) => !prev)}
                className="flex items-center justify-between p-3.5 text-left w-full hover:bg-[#FAF7F2] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6B5A5E]">
                    Need inspiration?
                  </span>
                  <span className="text-[11px] text-[#6B5A5E]/70 font-medium">(Starter ideas)</span>
                </div>
                <div className="flex size-6 items-center justify-center rounded-full bg-[#F3E6DA] text-[#9E2B57] transition-all">
                  {inspirationOpen ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
                </div>
              </button>

              {inspirationOpen && (
                <div className="flex flex-col gap-2 p-3 pt-0 border-t border-[#F3E6DA]/70 bg-[#FAF7F2]/40">
                  {quickStarters.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => updateDraft({ message: starter })}
                      className="p-2.5 text-left rounded-xl border border-[#E2D2C5] bg-white text-xs text-[#2A1F22] hover:border-[#9E2B57] hover:bg-[#FAF7F2] transition-colors"
                    >
                      "{starter}"
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* AI Assistant Button */}
            <Button
              type="button"
              variant="outline"
              onClick={generateMessage}
              disabled={Boolean(writing)}
              className="h-12 rounded-xl border-[#C9A9A0] font-semibold text-[#9E2B57]"
            >
              {writing ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Wand2 className="size-4 mr-2" />
              )}
              {draft.message.trim() ? "Improve wording with AI" : "Draft with AI"}
            </Button>

            {/* Typography & Lettering controls inside Step 2 */}
            <TextControls draft={draft} update={updateDraft} />
          </div>
        )}

        {/* STEP 3: ART & STYLING */}
        {currentStep === 3 && (
          <div className="flex flex-col gap-4">
            {/* Style Intensity / Strength */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6B5A5E]">
                Transformation Strength
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(["low", "medium", "high"] as const).map((intensity) => (
                  <button
                    key={intensity}
                    type="button"
                    onClick={() => {
                      const isRendered =
                        draft.styleId === "original" ||
                        Boolean(draft.artworkRenders?.[artworkKey(draft.styleId, intensity)]);

                      if (!isRendered && !genStatus.isAllowed) {
                        notifyLimitReached(genStatus);
                        return;
                      }

                      updateDraft({
                        styleIntensity: intensity,
                        styleJobStatus: isRendered ? "complete" : "queued",
                      });
                    }}
                    className={cn(
                      "py-2.5 px-2 text-center rounded-xl text-xs font-semibold border transition-all",
                      draft.styleIntensity === intensity
                        ? "bg-[#9E2B57] text-white border-[#9E2B57] font-bold shadow-sm"
                        : "bg-white text-[#2A1F22] border-[#E2D2C5] hover:border-[#C9A9A0]",
                    )}
                  >
                    {intensityLabels[intensity]}
                  </button>
                ))}
              </div>
            </div>

            {/* All 12 Artistic Mediums */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6B5A5E]">
                  Artistic Mediums
                </span>
                <span className="text-xs font-semibold text-[#6B5A5E]">
                  {visualStyles.length} styles
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {visualStyles.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => {
                      if (!draft.photo && style.id !== "original") {
                        toast.error("Add a photo first.");
                        return;
                      }

                      const isRendered =
                        style.id === "original" ||
                        Boolean(draft.artworkRenders?.[artworkKey(style.id, draft.styleIntensity)]);

                      if (!isRendered && !genStatus.isAllowed) {
                        notifyLimitReached(genStatus);
                        return;
                      }

                      updateDraft({
                        styleId: style.id,
                        styleJobStatus: isRendered ? "complete" : "queued",
                      });
                    }}
                    className={cn(
                      "flex flex-col overflow-hidden rounded-2xl border-[1.5px] bg-white text-left transition-all",
                      draft.styleId === style.id
                        ? "border-[#9E2B57] ring-2 ring-[#9E2B57]/30 shadow-sm font-bold"
                        : "border-[#E2D2C5] hover:border-[#C9A9A0]",
                    )}
                  >
                    <div className="relative aspect-square w-full overflow-hidden bg-stone-100">
                      <img
                        src={stylePreviews[style.id] ?? styleOriginal}
                        alt={style.label}
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                      />
                    </div>
                    <span className="p-2 text-center text-[12px] font-semibold text-[#2A1F22] truncate">
                      {style.label}
                    </span>
                  </button>
                ))}
              </div>
              <ArtworkGenerator draft={draft} update={updateDraft} />
            </div>
          </div>
        )}
      </main>

      {/* Action Bar matching Redesign */}
      <footer className="shrink-0 border-t border-[#E6D8CC] bg-[#FBF5EE] px-4 pt-3 pb-6 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          {currentStep > 1 && (
            <button
              type="button"
              aria-label="Back to previous step"
              onClick={() => setCurrentStep((prev) => (prev - 1) as StepId)}
              className="flex size-14 shrink-0 items-center justify-center rounded-2xl border-[1.5px] border-[#C9A9A0] bg-white text-[#2A1F22] hover:bg-[#FAF7F2] transition-colors"
            >
              <ChevronLeft className="size-6" />
            </button>
          )}

          {currentStep === 1 && (
            <Button
              type="button"
              disabled={!hasPhoto}
              onClick={() => setCurrentStep(2)}
              className="h-14 flex-1 rounded-2xl bg-[#9E2B57] hover:bg-[#852243] text-white font-bold text-base shadow-[0_4px_12px_rgba(158,43,87,0.22)] disabled:bg-[#E2D2C5] disabled:text-[#6B5A5E]"
            >
              Next: Message
            </Button>
          )}

          {currentStep === 2 && (
            <Button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="h-14 flex-1 rounded-2xl bg-[#9E2B57] hover:bg-[#852243] text-white font-bold text-base shadow-[0_4px_12px_rgba(158,43,87,0.22)]"
            >
              Next: Art
            </Button>
          )}

          {currentStep === 3 && (
            <Button
              type="button"
              onClick={() => setSendOpen(true)}
              className="h-14 flex-1 rounded-2xl bg-[#9E2B57] hover:bg-[#852243] text-white font-bold text-base shadow-[0_4px_12px_rgba(158,43,87,0.22)]"
            >
              Next: Send
            </Button>
          )}
        </div>
        <div className="text-center text-xs text-[#6B5A5E]">
          {currentStep === 1 && !hasPhoto
            ? "Choose a photo to continue"
            : currentStep === 1
              ? "Photo ready · Tap to write words"
              : currentStep === 2
                ? "Preview updates as you type"
                : "Free to preview and download"}
        </div>
      </footer>

      {/* Send or Schedule Drawer matching 5 Send or schedule.png */}
      <Sheet open={sendOpen} onOpenChange={setSendOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto rounded-t-[32px] bg-[#FBF5EE] p-5 text-[#2A1F22]"
        >
          <SheetHeader className="text-left pb-2">
            <SheetTitle className="font-serif text-2xl font-normal text-[#2A1F22]">
              Send your card
            </SheetTitle>
          </SheetHeader>

          {/* Card Summary Card */}
          <div className="flex items-center gap-3.5 rounded-2xl bg-[#F3E6DA] p-3">
            <div className="size-14 shrink-0 rounded-xl bg-white p-1 shadow-sm overflow-hidden flex items-center justify-center">
              {draft.photo?.dataUrl ? (
                <img
                  src={draft.photo.dataUrl}
                  alt=""
                  className="size-full rounded-lg object-cover"
                />
              ) : (
                <div className="size-full rounded-lg bg-[#E9B8A0]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-base font-bold text-[#2A1F22]">{draft.title || "Your card"}</div>
              <div className="text-xs text-[#6B5A5E]">
                {draft.ratioId.toUpperCase()} · {draft.styleId} style
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-4">
            {/* Who is it for? */}
            <div className="flex flex-col gap-2">
              <label htmlFor="who-input" className="text-sm font-bold text-[#2A1F22]">
                Who is it for?
              </label>
              <Input
                id="who-input"
                value={sendRecipient}
                onChange={(e) => setSendRecipient(e.target.value)}
                className="h-12 rounded-xl border-[1.5px] border-[#C9A9A0] bg-white text-base"
                placeholder="Recipient name"
              />
              <div className="flex gap-2">
                {["Mum", "Sam", "Aisha"].map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSendRecipient(name)}
                    className={cn(
                      "min-h-[36px] px-3.5 rounded-full border text-xs font-semibold transition-all",
                      sendRecipient === name
                        ? "bg-[#9E2B57] text-white border-[#9E2B57] font-bold"
                        : "bg-white text-[#2A1F22] border-[#E2D2C5]",
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* When: Send now vs Schedule */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold text-[#2A1F22]">When</span>
              <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[#F3E6DA] p-1">
                <button
                  type="button"
                  onClick={() => setWhenMode("now")}
                  className={cn(
                    "min-h-[44px] rounded-xl text-sm font-bold transition-all",
                    whenMode === "now"
                      ? "bg-white text-[#2A1F22] shadow-[0_1px_3px_rgba(42,31,34,0.12)]"
                      : "text-[#6B5A5E]",
                  )}
                >
                  Send now
                </button>
                <button
                  type="button"
                  onClick={() => setWhenMode("schedule")}
                  className={cn(
                    "min-h-[44px] rounded-xl text-sm font-bold transition-all",
                    whenMode === "schedule"
                      ? "bg-white text-[#2A1F22] shadow-[0_1px_3px_rgba(42,31,34,0.12)]"
                      : "text-[#6B5A5E]",
                  )}
                >
                  Schedule
                </button>
              </div>
            </div>

            {/* Calendar Widget when Schedule selected */}
            {whenMode === "schedule" && (
              <div className="flex flex-col gap-3 rounded-2xl border border-[#E2D2C5] bg-white p-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#2A1F22]">October 2026</span>
                  <span className="text-xs text-[#6B5A5E]">Today is Tue 13</span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[#6B5A5E]">
                  <span>Mo</span>
                  <span>Tu</span>
                  <span>We</span>
                  <span>Th</span>
                  <span>Fr</span>
                  <span>Sa</span>
                  <span>Su</span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {[...Array(31)].map((_, i) => {
                    const day = i + 1;
                    const isSelected = scheduledDay === day;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setScheduledDay(day)}
                        className={cn(
                          "size-8 mx-auto rounded-full text-xs font-semibold flex items-center justify-center transition-all",
                          isSelected
                            ? "bg-[#9E2B57] text-white font-bold"
                            : "text-[#2A1F22] hover:bg-[#F3E6DA]",
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#F3E6DA]">
                  <label className="text-xs font-semibold text-[#2A1F22]">Repeat every year</label>
                  <Switch checked={repeatYearly} onCheckedChange={setRepeatYearly} />
                </div>
              </div>
            )}

            {/* Action CTA */}
            {whenMode === "schedule" ? (
              <Button
                type="button"
                onClick={() => {
                  toast.success(`Card scheduled for ${scheduledDay} Oct!`);
                  setSendOpen(false);
                }}
                className="h-14 rounded-2xl bg-[#9E2B57] hover:bg-[#852243] text-white font-bold text-base shadow-[0_4px_12px_rgba(158,43,87,0.22)]"
              >
                Schedule for Sat {scheduledDay} Oct, 09:00
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={Boolean(exporting)}
                    onClick={() => void runExport("png")}
                    className="h-12 rounded-xl border-[#C9A9A0] font-semibold"
                  >
                    {exporting === "png" ? (
                      <Loader2 className="size-4 animate-spin mr-2" />
                    ) : (
                      <Download className="size-4 mr-2 text-[#9E2B57]" />
                    )}
                    Save PNG
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={Boolean(exporting)}
                    onClick={() => void runExport("pdf")}
                    className="h-12 rounded-xl border-[#C9A9A0] font-semibold"
                  >
                    {exporting === "pdf" ? (
                      <Loader2 className="size-4 animate-spin mr-2" />
                    ) : (
                      <FileText className="size-4 mr-2 text-[#9E2B57]" />
                    )}
                    Save PDF
                  </Button>
                </div>
                <Button
                  type="button"
                  onClick={() => void shareCard(draft, "whatsapp")}
                  className="h-12 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold"
                >
                  <MessageCircle className="size-4 mr-2" />
                  Send via WhatsApp
                </Button>
                <Button
                  type="button"
                  onClick={() => void shareCard(draft, "any")}
                  className="h-12 rounded-xl bg-[#9E2B57] hover:bg-[#852243] text-white font-bold"
                >
                  <Share2 className="size-4 mr-2" />
                  Share Link
                </Button>
                <PrintHandoff draft={draft} />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
