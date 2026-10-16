import { ratios } from "@/domain/content";
import type { RatioId } from "@/domain/entities/types";
import { cn } from "@/lib/utils";

const BOX = 28; // px: largest edge of each shape thumbnail, sized for single-row mobile

/** Card shape picker: each option draws the card at its true proportions in a single row. */
export function RatioSelector({
  value,
  onChange,
}: {
  value: RatioId;
  onChange: (value: RatioId) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5" role="group" aria-label="Card shape">
      {ratios.map((ratio) => {
        const isSelected = value === ratio.id;
        const [mainLabel, ...rest] = ratio.label.split(" ");
        const width = ratio.aspect >= 1 ? BOX : Math.round(BOX * ratio.aspect);
        const height = ratio.aspect >= 1 ? Math.round(BOX / ratio.aspect) : BOX;
        return (
          <button
            key={ratio.id}
            type="button"
            aria-pressed={isSelected}
            aria-label={`${ratio.label}. ${ratio.note}`}
            onClick={() => onChange(ratio.id)}
            className={cn(
              "flex flex-col items-center justify-between gap-1 rounded-xl sm:rounded-2xl border-[1.5px] bg-white px-1 py-1.5 sm:px-2 sm:py-2.5 text-center transition-all",
              isSelected
                ? "border-[#9E2B57] ring-2 ring-[#9E2B57]/25 shadow-sm"
                : "border-[#E2D2C5] hover:border-[#C9A9A0]",
            )}
          >
            <span className="flex size-9 sm:size-11 items-center justify-center rounded-lg bg-[#FBF5EE]">
              <span
                aria-hidden="true"
                className={cn(
                  "block rounded-[3px] border-[1.5px] transition-colors",
                  isSelected ? "border-[#9E2B57] bg-[#9E2B57]/15" : "border-[#C9A9A0] bg-[#F3E6DA]",
                )}
                style={{ width, height }}
              />
            </span>
            <div className="flex flex-col items-center leading-none">
              <span
                className={cn(
                  "text-[11px] sm:text-[13px] font-bold leading-tight truncate max-w-full",
                  isSelected ? "text-[#9E2B57]" : "text-[#2A1F22]",
                )}
              >
                {mainLabel}
              </span>
              <span className="text-[9px] sm:text-[11px] leading-tight text-[#6B5A5E]">
                {rest.join(" ")}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
