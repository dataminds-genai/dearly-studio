import { RotateCw, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { CreationDraft } from "@/domain/entities/types";

export function ImageControls({ draft, update }: { draft: CreationDraft; update: (patch: Partial<CreationDraft>) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <ZoomIn className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <Slider
        aria-label="Photo zoom"
        min={100}
        max={300}
        step={5}
        value={[Math.round((draft.imageZoom ?? 1) * 100)]}
        onValueChange={([value]) => update({ imageZoom: (value ?? 100) / 100 })}
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="Rotate photo 90 degrees"
        title="Rotate photo"
        onClick={() => update({ imageRotation: (((draft.imageRotation ?? 0) + 90) % 360) as CreationDraft["imageRotation"] })}
      >
        <RotateCw className="size-4" aria-hidden="true" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => update({ imagePan: { x: 0, y: 0 }, imageZoom: 1, imageRotation: 0 })}
      >
        Reset
      </Button>
    </div>
  );
}