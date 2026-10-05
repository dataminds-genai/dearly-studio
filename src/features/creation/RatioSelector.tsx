import { RectangleHorizontal, RectangleVertical, Square } from "lucide-react";
import { ratios } from "@/domain/content";
import type { RatioId } from "@/domain/entities/types";
import { cn } from "@/lib/utils";

export function RatioSelector({ value, onChange }: { value: RatioId; onChange: (value: RatioId) => void }) {
  return (
    <div className="mt-3 grid grid-cols-5 gap-1 rounded-2xl border border-border/70 bg-card/70 p-1.5 shadow-sm backdrop-blur-xl" aria-label="Card format">
      {ratios.map((ratio) => {
        const Icon = ratio.aspect === 1 ? Square : ratio.aspect > 1 ? RectangleHorizontal : RectangleVertical;
        return (
          <button
            key={ratio.id}
            type="button"
            aria-pressed={value === ratio.id}
            aria-label={`${ratio.label}. ${ratio.note}`}
            onClick={() => onChange(ratio.id)}
            className={cn(
              "tap-safe flex min-w-0 flex-col items-center justify-center rounded-xl px-1 py-1.5 text-[10px] leading-tight transition",
              value === ratio.id ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="mb-1 size-4" aria-hidden="true" />
            <span>{ratio.label.split(" ")[0]}</span>
            <span className="font-semibold">{ratio.label.split(" ").slice(1).join(" ")}</span>
          </button>
        );
      })}
    </div>
  );
}