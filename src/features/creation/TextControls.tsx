import { AlignCenter, AlignLeft, AlignRight, Bold, ChevronDown, Italic, Underline } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { cardFonts } from "@/domain/content";
import type { CreationDraft, FontId } from "@/domain/entities/types";

/** Font picker as a simple dropdown; text placement is done by dragging on the card. */
export function TextControls({
  draft,
  update,
}: {
  draft: CreationDraft;
  update: (patch: Partial<CreationDraft>) => void;
}) {
  const selected = cardFonts.find((font) => font.id === draft.fontId) ?? cardFonts[0];

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-3">
      <label
        htmlFor="card-font-select"
        className="px-1 text-[13px] font-medium uppercase tracking-wide text-muted-foreground"
      >
        Font
      </label>
      <div className="relative mt-2">
        <select
          id="card-font-select"
          value={draft.fontId}
          onChange={(event) => update({ fontId: event.target.value as FontId })}
          className="tap-safe h-12 w-full appearance-none rounded-xl border border-border bg-card px-4 pr-10 text-[16px] text-foreground"
          style={{ fontFamily: selected?.family, fontWeight: selected?.weight }}
        >
          {cardFonts.map((font) => (
            <option key={font.id} value={font.id}>
              {font.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Size</span>
        <Slider aria-label="Text size" min={2.5} max={9} step={0.25} value={[draft.textFontSize ?? 4.5]} onValueChange={([value]) => update({ textFontSize: value ?? 4.5 })} />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Toggle aria-label="Bold" pressed={draft.textBold ?? true} onPressedChange={(textBold) => update({ textBold })}><Bold /></Toggle>
        <Toggle aria-label="Italic" pressed={draft.textItalic ?? false} onPressedChange={(textItalic) => update({ textItalic })}><Italic /></Toggle>
        <Toggle aria-label="Underline" pressed={draft.textUnderline ?? false} onPressedChange={(textUnderline) => update({ textUnderline })}><Underline /></Toggle>
        <span className="mx-1 h-6 w-px bg-border" />
        {(["left", "center", "right"] as const).map((alignment) => {
          const Icon = alignment === "left" ? AlignLeft : alignment === "right" ? AlignRight : AlignCenter;
          return <Toggle key={alignment} aria-label={`Align ${alignment}`} pressed={(draft.textAlign ?? "center") === alignment} onPressedChange={(pressed) => pressed && update({ textAlign: alignment })}><Icon /></Toggle>;
        })}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2" aria-label="Text color">
          {(["light", "dark", "rose", "gold"] as const).map((color) => <button key={color} type="button" aria-label={`${color} text`} aria-pressed={(draft.textColor ?? "light") === color} onClick={() => update({ textColor: color })} className={`text-swatch text-swatch-${color} ${(draft.textColor ?? "light") === color ? "ring-2 ring-primary ring-offset-2" : ""}`} />)}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => update({ textBackdrop: draft.textBackdrop === "none" ? "soft" : draft.textBackdrop === "soft" ? "strong" : "none" })}>Backdrop: {draft.textBackdrop ?? "soft"}</Button>
      </div>
    </div>
  );
}
