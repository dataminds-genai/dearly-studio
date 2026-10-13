import { ratios } from "@/domain/content";
import type { RatioId } from "@/domain/entities/types";
import { cn } from "@/lib/utils";

const BOX = 52; // px: the largest edge of each shape thumbnail

/** Card shape picker: each option draws the card at its true proportions. */
export function RatioSelector({
  value,
  onChange,
}: {
  value: RatioId;
  onChange: (value: RatioId) => void;
}) {
  return (
    <div
      className="grid grid-cols-3 gap-2.5 sm:grid-cols-5"
      role="group"
      aria-label="Card shape"
    >
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
              "tap-safe flex flex-col items-center gap-1.5 rounded-2xl border-[1.5px] bg-white px-2 py-2.5 text-center transition-all",
              isSelected
                ? "border-[#9E2B57] ring-2 ring-[#9E2B57]/25 shadow-sm"
                : "border-[#E2D2C5] hover:border-[#C9A9A0]",
            )}
          >
            <span className="flex size-[60px] items-center justify-center rounded-xl bg-[#FBF5EE]">
              <span
                aria-hidden="true"
                className={cn(
                  "block rounded-[5px] border-2 transition-colors",
                  isSelected ? "border-[#9E2B57] bg-[#9E2B57]/15" : "border-[#C9A9A0] bg-[#F3E6DA]",
                )}
                style={{ width, height }}
              />
            </span>
            <span
              className={cn(
                "text-[13px] font-bold leading-tight",
                isSelected ? "text-[#9E2B57]" : "text-[#2A1F22]",
              )}
            >
              {mainLabel}
            </span>
            <span className="text-[11px] leading-tight text-[#6B5A5E]">
              {rest.join(" ")}
            </span>
          </button>
        );
      })}
    </div>
  );
}