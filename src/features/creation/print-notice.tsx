import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { CreationDraft } from "@/domain/entities/types";

const SEEN_KEY = "dearly.printNotice.v1";

/** Library/Unsplash photos carry third-party print-use terms. */
export function isLibraryPhoto(draft: CreationDraft): boolean {
  const id = draft.photo?.sampleId ?? "";
  return id.startsWith("library-") || id.startsWith("unsplash-");
}

function seen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "seen";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "seen");
  } catch {
    /* private mode — ask again next time */
  }
}

/**
 * One-time notice before a library photo goes to a physical/paid output.
 * Returns true when the flow may continue. Render `dialog` once per screen.
 */
export function usePrintNotice() {
  const [open, setOpen] = useState(false);
  const resolveRef = useRef<(go: boolean) => void>(null);

  const requestPrintGoAhead = useCallback((draft: CreationDraft): Promise<boolean> => {
    if (!isLibraryPhoto(draft) || seen()) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOpen(true);
    });
  }, []);

  const settle = useCallback((go: boolean) => {
    setOpen(false);
    if (go) markSeen();
    resolveRef.current?.(go);
    resolveRef.current = null;
  }, []);

  const dialog = (
    <AlertDialog open={open} onOpenChange={(next) => !next && settle(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Quick check before printing</AlertDialogTitle>
          <AlertDialogDescription>
            This photo is from the Unsplash library, which has its own terms for printed products.
            Personal cards are usually fine, but please print within those terms.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>Use my own photo</AlertDialogCancel>
          <AlertDialogAction onClick={() => settle(true)}>Got it, continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { requestPrintGoAhead, dialog };
}
