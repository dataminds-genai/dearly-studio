import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { CreationDraft } from "@/domain/entities/types";
import { artworkKey, isArtStyleId } from "@/lib/art-style";
import { streamImage } from "@/lib/stream-image";
import { renderArtOnDevice } from "./local-art";

async function dataUrlToFile(dataUrl: string, fallbackName = "photo.jpg"): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const type = blob.type || "image/jpeg";
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  return new File([blob], fallbackName.endsWith(`.${ext}`) ? fallbackName : `photo.${ext}`, {
    type,
  });
}

/** Renders the chosen style: Cloudflare Workers AI first, on-device canvas fallback. */
export function ArtworkGenerator({
  draft,
  update,
}: {
  draft: CreationDraft;
  update: (patch: Partial<CreationDraft>) => void;
}) {
  const [onDevice, setOnDevice] = useState(false);
  const styleId = draft.styleId;
  const key = artworkKey(styleId, draft.styleIntensity);
  const processing = draft.styleJobStatus === "processing";
  const startedKey = useRef<string | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  async function renderOnDevice(photoDataUrl: string, reason?: string, asError = false) {
    setOnDevice(true);
    // Let the painting animation start before the heavy work blocks the thread.
    await new Promise((resolve) => setTimeout(resolve, 60));
    const image = await renderArtOnDevice(photoDataUrl, draftRef.current.styleId);
    if (reason) {
      if (asError) toast.error(reason);
      else toast.message(reason);
    }
    return image;
  }

  async function createArtwork() {
    const photo = draftRef.current.photo;
    const currentStyle = draftRef.current.styleId;
    const currentKey = artworkKey(currentStyle, draftRef.current.styleIntensity);
    if (!photo?.dataUrl || !isArtStyleId(currentStyle)) {
      toast.error("Add a photo before choosing a style.");
      update({ styleId: "original", styleJobStatus: "complete" });
      return;
    }
    setOnDevice(false);
    update({ styleJobStatus: "processing" });
    const started = Date.now();
    const save = (image: string) =>
      update({
        artworkRenders: { ...(draftRef.current.artworkRenders ?? {}), [currentKey]: image },
        styleJobStatus: "complete",
      });
    try {
      const file = await dataUrlToFile(photo.dataUrl, photo.fileName ?? "photo.jpg");
      const form = new FormData();
      form.set("image", file);
      form.set("styleId", currentStyle);
      form.set("intensity", draftRef.current.styleIntensity);
      let sawFrame = false;
      let freeTierServe = false;
      await streamImage("/api/edit-artwork", form, (dataUrl, isFinal, meta) => {
        sawFrame = true;
        if (meta.freeTier) freeTierServe = true;
        if (isFinal) {
          save(dataUrl);
          if (freeTierServe) {
            toast.message("Free-tier artwork — quality may vary. Top up pollen for best results.");
          }
        } else {
          // Progressive preview: show partial frame without marking complete.
          update({
            artworkRenders: { ...(draftRef.current.artworkRenders ?? {}), [currentKey]: dataUrl },
          });
        }
      });
      if (!sawFrame) throw new Error("Artwork creation returned no image.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Artwork could not be created.";
      // Any provider-stage failure (unconfigured, quota, gated model, network)
      // falls back to on-device rendering. Only request-validation errors
      // (checked before providers run) surface directly.
      const fallbackable =
        !/must come from Dearly Studio|photo, artist|supported artist|smaller than 25 MB/i.test(
          message,
        );
      if (fallbackable) {
        try {
          // Actionable provider errors (e.g. empty Pollen balance) reach the
          // user as-is; everything else gets the generic notice.
          const actionable = /pollen|top.?up|insufficient balance|quota/i.test(message);
          const image = await renderOnDevice(
            photo.dataUrl,
            actionable ? message : "Server art unavailable — on-device version shown.",
            actionable,
          );
          const minimum = 1400 - (Date.now() - started);
          if (minimum > 0) await new Promise((resolve) => setTimeout(resolve, minimum));
          save(image);
          return;
        } catch (fallbackError) {
          toast.error(fallbackError instanceof Error ? fallbackError.message : message);
          update({ styleJobStatus: "failed" });
          return;
        }
      }
      toast.error(message);
      update({ styleJobStatus: "failed" });
      return;
    }
    const minimum = 1400 - (Date.now() - started);
    if (minimum > 0) await new Promise((resolve) => setTimeout(resolve, minimum));
  }

  useEffect(() => {
    if (
      draft.styleJobStatus !== "queued" ||
      !draft.photo ||
      !isArtStyleId(styleId) ||
      startedKey.current === key
    )
      return;
    startedKey.current = key;
    void createArtwork();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.photo, draft.styleJobStatus, key, styleId]);

  if (styleId === "original") return null;

  return (
    <div className="mt-3 flex items-center justify-between gap-3 px-1" aria-live="polite">
      <p className="text-xs text-muted-foreground">
        {processing
          ? onDevice
            ? "Rendering artwork on device..."
            : "Painting your artwork…"
          : draft.styleJobStatus === "failed"
            ? "That style didn't work. Try again."
            : "Your original photo stays unchanged."}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 gap-1.5"
        disabled={processing || !draft.photo}
        onClick={() => {
          startedKey.current = key;
          void createArtwork();
        }}
      >
        <RefreshCw className="size-3.5" aria-hidden="true" />
        Repaint
      </Button>
    </div>
  );
}
