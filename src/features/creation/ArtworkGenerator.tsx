import { useEffect, useRef, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { CreationDraft } from "@/domain/entities/types";
import { artworkKey, isArtStyleId } from "@/lib/art-style";
import { streamImage } from "@/lib/stream-image";
import { renderArtOnDevice } from "./local-art";
import { useAuth } from "@/features/auth/auth-context";
import { useGenerationLimit } from "@/domain/services/generation-limit";
import { DailyLimitModal } from "./DailyLimitModal";
import { cn } from "@/lib/utils";

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
  const { user } = useAuth();
  const { status, record } = useGenerationLimit(user?.id);
  const [showLimitModal, setShowLimitModal] = useState(false);
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
      else toast.info(reason);
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

    // Check daily generation limit
    if (!status.isAllowed) {
      setShowLimitModal(true);
      update({
        styleJobStatus: "complete",
        styleId: draftRef.current.artworkRenders?.[currentKey] ? currentStyle : "original",
      });
      return;
    }

    setOnDevice(false);
    update({ styleJobStatus: "processing" });
    const started = Date.now();
    const save = (image: string) => {
      const updatedStatus = record();
      update({
        artworkRenders: { ...(draftRef.current.artworkRenders ?? {}), [currentKey]: image },
        styleJobStatus: "complete",
      });

      // Show thoughtful notifications based on daily generation thresholds
      if (updatedStatus.count === updatedStatus.warningThreshold && updatedStatus.isLoggedIn) {
        toast.warning(
          `Daily generation warning: You've created ${updatedStatus.count} of ${updatedStatus.limit} artworks today. ${updatedStatus.remaining} remaining.`,
          { duration: 5000 },
        );
      } else if (updatedStatus.isLimitReached) {
        if (updatedStatus.isLoggedIn) {
          toast.info(
            `You have reached your daily cap of ${updatedStatus.limit} images. Please try again after 24 hours.`,
            { duration: 6000 },
          );
        } else {
          toast.info(
            `Daily guest limit reached (${updatedStatus.limit}/${updatedStatus.limit}). Sign in to get ${updatedStatus.limitLoggedIn} image generations every day!`,
            { duration: 6000 },
          );
        }
      }
    };

    try {
      const file = await dataUrlToFile(photo.dataUrl, photo.fileName ?? "photo.jpg");
      const form = new FormData();
      form.set("image", file);
      form.set("styleId", currentStyle);
      form.set("intensity", draftRef.current.styleIntensity);
      if (user?.id) {
        form.set("userId", user.id);
      }
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
      if (/limit reached|after 24 hours/i.test(message)) {
        setShowLimitModal(true);
        update({ styleJobStatus: "complete" });
        return;
      }
      try {
        const actionable = /pollen|top.?up|insufficient balance|quota|allowance/i.test(message);
        const image = await renderOnDevice(
          photo.dataUrl,
          actionable ? "Cloud AI quota reached — created using on-device artist engine." : undefined,
          false,
        );
        const minimum = 1000 - (Date.now() - started);
        if (minimum > 0) await new Promise((resolve) => setTimeout(resolve, minimum));
        save(image);
        return;
      } catch (fallbackError) {
        toast.error(fallbackError instanceof Error ? fallbackError.message : message);
        update({ styleJobStatus: "failed" });
        return;
      }
    }
    const minimum = 1000 - (Date.now() - started);
    if (minimum > 0) await new Promise((resolve) => setTimeout(resolve, minimum));
  }

  useEffect(() => {
    if (
      draft.styleJobStatus !== "queued" ||
      !draft.photo?.dataUrl ||
      !isArtStyleId(styleId) ||
      processing
    )
      return;
    void createArtwork();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.photo?.dataUrl, draft.styleJobStatus, key, styleId]);

  if (styleId === "original") return null;

  return (
    <>
      <DailyLimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        status={status}
      />
      <div className="mt-3 flex items-center justify-between gap-3 px-1" aria-live="polite">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-muted-foreground">
            {processing
              ? onDevice
                ? "Rendering artwork on device..."
                : "Painting your artwork…"
              : draft.styleJobStatus === "failed"
                ? "That style didn't work. Try again."
                : "Your original photo stays unchanged."}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border transition-colors",
                status.isLimitReached
                  ? "bg-[#A8261E]/10 text-[#A8261E] border-[#A8261E]/20"
                  : status.shouldWarn
                    ? "bg-[#D97706]/15 text-[#B45309] border-[#D97706]/30"
                    : "bg-white text-[#6B5A5E] border-[#E2D2C5]",
              )}
            >
              <Sparkles className="size-3" />
              <span>
                {status.remaining} / {status.limit} daily creations left
              </span>
            </span>
            {status.shouldWarn && status.remaining > 0 && (
              <span className="text-[11px] font-medium text-[#B45309]">
                (Warning: 5 used)
              </span>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1.5"
          disabled={processing || !draft.photo}
          onClick={() => {
            if (!status.isAllowed) {
              setShowLimitModal(true);
              return;
            }
            startedKey.current = key;
            void createArtwork();
          }}
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Repaint
        </Button>
      </div>
    </>
  );
}

