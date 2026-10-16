import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Italic,
  Underline,
} from "lucide-react";
import { cardFonts } from "@/domain/content";
import type { CreationDraft, FontId } from "@/domain/entities/types";
import { cn } from "@/lib/utils";

/**
 * Sleek typography controls:
 * - Line 1: Font dropdown, Big A / small A size, BIU toggles
 * - Line 2: Font color selection, alignment and Backdrop in the same line
 */
export function TextControls({
  draft,
  update,
}: {
  draft: CreationDraft;
  update: (patch: Partial<CreationDraft>) => void;
}) {
  const selected = cardFonts.find((font) => font.id === draft.fontId) ?? cardFonts[0];
  const currentSize = draft.textFontSize ?? 4.5;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[#E2D2C5] bg-white p-3 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B5A5E]">
          Typography & Lettering
        </span>
        <span className="text-[11px] font-semibold text-[#6B5A5E]">
          Size: {currentSize.toFixed(1)}
        </span>
      </div>

      {/* LINE 1: Font Dropdown | Size (Small A / Big A) | BIU */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Sleek Font dropdown */}
        <div className="relative min-w-[110px] flex-1">
          <select
            id="card-font-select"
            aria-label="Font family"
            value={draft.fontId}
            onChange={(event) => update({ fontId: event.target.value as FontId })}
            className="h-9 w-full appearance-none rounded-xl border border-[#E2D2C5] bg-[#FAF7F2] px-3 pr-7 text-xs font-bold text-[#2A1F22] hover:border-[#9E2B57] focus:outline-none focus:ring-1 focus:ring-[#9E2B57] transition-all cursor-pointer truncate"
            style={{ fontFamily: selected?.family }}
          >
            {cardFonts.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#6B5A5E]"
            aria-hidden="true"
          />
        </div>

        {/* Font size: Sleek Small A / Big A buttons (no slider) */}
        <div className="flex items-center rounded-xl border border-[#E2D2C5] bg-[#FAF7F2] p-0.5 shrink-0">
          <button
            type="button"
            title="Decrease font size (Small A)"
            aria-label="Decrease font size"
            onClick={() => {
              update({ textFontSize: Math.max(2.5, Number((currentSize - 0.5).toFixed(1))) });
            }}
            className="flex size-8 items-center justify-center rounded-lg text-[#2A1F22] hover:bg-white active:scale-95 transition-all"
          >
            <span className="text-[11px] font-bold leading-none">A</span>
          </button>
          <span className="h-4 w-px bg-[#E2D2C5]" />
          <button
            type="button"
            title="Increase font size (Big A)"
            aria-label="Increase font size"
            onClick={() => {
              update({ textFontSize: Math.min(9.0, Number((currentSize + 0.5).toFixed(1))) });
            }}
            className="flex size-8 items-center justify-center rounded-lg text-[#2A1F22] hover:bg-white active:scale-95 transition-all"
          >
            <span className="text-[15px] font-extrabold leading-none">A</span>
          </button>
        </div>

        {/* BIU formatting toggles */}
        <div className="flex items-center rounded-xl border border-[#E2D2C5] bg-[#FAF7F2] p-0.5 shrink-0">
          <button
            type="button"
            aria-label="Bold"
            title="Bold"
            onClick={() => update({ textBold: !(draft.textBold ?? true) })}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg font-bold text-xs transition-all",
              (draft.textBold ?? true)
                ? "bg-[#9E2B57] text-white shadow-xs"
                : "text-[#2A1F22] hover:bg-white",
            )}
          >
            <Bold className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Italic"
            title="Italic"
            onClick={() => update({ textItalic: !(draft.textItalic ?? false) })}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg text-xs transition-all",
              draft.textItalic
                ? "bg-[#9E2B57] text-white shadow-xs"
                : "text-[#2A1F22] hover:bg-white",
            )}
          >
            <Italic className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Underline"
            title="Underline"
            onClick={() => update({ textUnderline: !(draft.textUnderline ?? false) })}
            className={cn(
              "flex size-8 items-center justify-center rounded-lg text-xs transition-all",
              draft.textUnderline
                ? "bg-[#9E2B57] text-white shadow-xs"
                : "text-[#2A1F22] hover:bg-white",
            )}
          >
            <Underline className="size-3.5" />
          </button>
        </div>
      </div>

      {/* LINE 2: Font color selection, alignment and Backdrop in the same line */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#F3E6DA]/80">
        {/* Color dropdown with swatch */}
        <div className="relative shrink-0">
          <select
            id="card-color-select"
            aria-label="Text color"
            value={draft.textColor ?? "light"}
            onChange={(e) =>
              update({ textColor: e.target.value as "light" | "dark" | "rose" | "gold" })
            }
            className="h-8 appearance-none rounded-xl border border-[#E2D2C5] bg-[#FAF7F2] pl-6 pr-6 text-xs font-bold text-[#2A1F22] hover:border-[#9E2B57] focus:outline-none focus:ring-1 focus:ring-[#9E2B57] transition-all cursor-pointer"
          >
            <option value="light">White</option>
            <option value="dark">Charcoal</option>
            <option value="rose">Rose</option>
            <option value="gold">Gold</option>
          </select>
          <span
            className={cn(
              "pointer-events-none absolute left-2 top-1/2 size-2.5 -translate-y-1/2 rounded-full border border-black/20 shadow-xs",
              (draft.textColor ?? "light") === "light" && "bg-[#fffdf8]",
              (draft.textColor ?? "light") === "dark" && "bg-[#292522]",
              (draft.textColor ?? "light") === "rose" && "bg-[#b84f63]",
              (draft.textColor ?? "light") === "gold" && "bg-[#d6aa42]",
            )}
          />
          <ChevronDown
            className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-[#6B5A5E]"
            aria-hidden="true"
          />
        </div>

        {/* Alignment toggles */}
        <div className="flex items-center rounded-xl border border-[#E2D2C5] bg-[#FAF7F2] p-0.5 shrink-0">
          {(["left", "center", "right"] as const).map((alignment) => {
            const Icon =
              alignment === "left" ? AlignLeft : alignment === "right" ? AlignRight : AlignCenter;
            const isSel = (draft.textAlign ?? "center") === alignment;
            return (
              <button
                key={alignment}
                type="button"
                aria-label={`Align ${alignment}`}
                onClick={() => update({ textAlign: alignment })}
                className={cn(
                  "flex size-7 items-center justify-center rounded-lg transition-all",
                  isSel ? "bg-[#9E2B57] text-white shadow-xs" : "text-[#6B5A5E] hover:bg-white",
                )}
              >
                <Icon className="size-3.5" />
              </button>
            );
          })}
        </div>

        {/* Backdrop toggle pill */}
        <button
          type="button"
          onClick={() =>
            update({
              textBackdrop:
                draft.textBackdrop === "none"
                  ? "soft"
                  : draft.textBackdrop === "soft"
                    ? "strong"
                    : "none",
            })
          }
          className="h-8 px-2.5 rounded-xl border border-[#E2D2C5] bg-[#FAF7F2] text-[11px] font-semibold text-[#6B5A5E] hover:border-[#9E2B57] hover:text-[#9E2B57] transition-all shrink-0"
        >
          Backdrop:{" "}
          <span className="text-[#2A1F22] font-bold capitalize">
            {draft.textBackdrop ?? "soft"}
          </span>
        </button>
      </div>
    </div>
  );
}
