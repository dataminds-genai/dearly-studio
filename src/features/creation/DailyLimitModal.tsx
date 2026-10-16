import { Clock, Sparkles, X, UserCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { GenerationStatus } from "@/domain/services/generation-limit";

interface DailyLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: GenerationStatus;
}

export function DailyLimitModal({ isOpen, onClose, status }: DailyLimitModalProps) {
  if (!isOpen) return null;

  const isGuest = !status.isLoggedIn;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-limit-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-[#E2D2C5] bg-[#FBF5EE] p-6 text-center shadow-xl animate-in zoom-in-95 duration-200 relative"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="tap-safe absolute right-4 top-4 rounded-full p-1.5 text-[#6B5A5E] hover:bg-[#F3E6DA] hover:text-[#2A1F22] transition-colors"
        >
          <X className="size-4" />
        </button>

        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#F3E6DA] text-[#9E2B57] shadow-xs">
          {isGuest ? <Sparkles className="size-7" /> : <Clock className="size-7" />}
        </div>

        <h3
          id="daily-limit-title"
          className="mt-4 font-serif text-2xl font-normal text-[#2A1F22]"
        >
          {isGuest ? "Daily Guest Limit Reached" : "Daily Limit Exceeded"}
        </h3>

        <p className="mt-2 text-sm text-[#6B5A5E] leading-relaxed">
          {isGuest ? (
            <>
              You have created your <strong className="text-[#2A1F22]">{status.limit} free artwork</strong> today.
              Please register or sign in first to get{" "}
              <strong className="text-[#9E2B57]">{status.limitLoggedIn} daily artwork generations</strong>!
            </>
          ) : (
            <>
              You have reached your daily limit of <strong className="text-[#2A1F22]">{status.limit} image generations</strong>.
              To ensure fast and reliable creations for everyone, limits refresh after 24 hours.
            </>
          )}
        </p>

        {!isGuest && (
          <div className="mt-4 rounded-2xl border border-[#E2D2C5] bg-white p-3.5 text-center">
            <span className="text-xs uppercase font-bold tracking-wider text-[#6B5A5E] block">
              Allowance Refreshes In
            </span>
            <span className="font-serif text-xl font-normal text-[#9E2B57] mt-0.5 block">
              {status.formattedResetTime}
            </span>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2.5">
          {isGuest ? (
            <>
              <Link
                to="/auth"
                className="tap-safe flex h-12 w-full items-center justify-center rounded-2xl bg-[#9E2B57] text-white font-bold text-sm shadow-sm hover:bg-[#852243] transition-colors"
              >
                <UserCheck className="size-4 mr-2" />
                Register to get {status.limitLoggedIn} creations/day
              </Link>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="h-10 text-sm font-semibold text-[#6B5A5E] hover:text-[#2A1F22]"
              >
                Keep editing with original photo
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                onClick={onClose}
                className="h-12 rounded-2xl bg-[#9E2B57] hover:bg-[#852243] text-white font-bold text-sm shadow-sm"
              >
                Understood
              </Button>
              <Link
                to="/account"
                className="tap-safe flex h-10 w-full items-center justify-center text-xs font-semibold text-[#6B5A5E] hover:text-[#2A1F22]"
              >
                Check allowance in Profile
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
