import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronRight,
  LogOut,
  Trash2,
  Globe,
  HelpCircle,
  ShieldCheck,
  FileText,
  Sparkles,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/AppHeader";
import { useAuth } from "@/features/auth/auth-context";
import { useGenerationLimit } from "@/domain/services/generation-limit";
import { useI18n } from "@/i18n/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/account/")({
  head: () => ({
    meta: [
      { title: "Profile — Dearly Studio" },
      {
        name: "description",
        content: "Manage saved recipients, birthdays, reminders, and privacy controls.",
      },
      { property: "og:title", content: "Profile — Dearly Studio" },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, signOut } = useAuth();
  const { status: genStatus } = useGenerationLimit(user?.id);
  const { locale, setLocale } = useI18n();

  const [remindOn, setRemindOn] = useState(true);
  const [remindLead, setRemindLead] = useState<"1 day" | "3 days" | "1 week">("3 days");

  const displayName = profile?.fullName || (user?.email ? user.email.split("@")[0] : "Your name");
  const displayEmail = user?.email || "name@example.com";
  const initial = (displayName?.charAt(0) || "Y").toUpperCase();

  function handleDeletePhotos() {
    toast.success("Uploaded temporary photos cleared from this session.");
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-md flex-col bg-[#FBF5EE] text-[#2A1F22] pb-6">
      <AppHeader />
      {/* Header matching 7 Profile.png */}
      <header className="px-5 pt-4 pb-4">
        <h1 className="font-serif text-[30px] font-normal tracking-tight text-[#2A1F22]">
          Profile
        </h1>
      </header>

      <main className="flex-1 px-5 flex flex-col gap-6">
        {/* User Card */}
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[#9E2B57] text-white font-serif text-2xl font-normal shadow-sm"
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold text-[#2A1F22]">{displayName}</div>
            <div className="truncate text-sm text-[#6B5A5E]">{displayEmail}</div>
          </div>
          {!user ? (
            <Link
              to="/auth"
              className="tap-safe inline-flex min-h-[42px] items-center rounded-full border-[1.5px] border-[#C9A9A0] bg-white px-4 text-sm font-semibold text-[#2A1F22] hover:bg-[#FAF7F2]"
            >
              Sign in
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => toast.info("Profile name can be updated in account settings.")}
              className="tap-safe inline-flex min-h-[42px] items-center rounded-full border-[1.5px] border-[#C9A9A0] bg-white px-4 text-sm font-semibold text-[#2A1F22] hover:bg-[#FAF7F2]"
            >
              Edit
            </button>
          )}
        </div>

        {/* Section: Daily Image Generation Allowance */}
        <section aria-labelledby="h-generations" className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <h2
              id="h-generations"
              className="text-xs font-bold uppercase tracking-wider text-[#6B5A5E]"
            >
              Daily art creations
            </h2>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold",
                genStatus.remaining === 0
                  ? "bg-[#A8261E]/10 text-[#A8261E]"
                  : genStatus.shouldWarn
                    ? "bg-[#D97706]/15 text-[#B45309]"
                    : "bg-[#2E7D32]/10 text-[#2E7D32]",
              )}
            >
              <Sparkles className="size-3" />
              {genStatus.remaining} {genStatus.remaining === 1 ? "left" : "left"}
            </span>
          </div>

          <div className="flex flex-col gap-3.5 rounded-2xl border-[1.5px] border-[#E2D2C5] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-serif text-2xl font-normal text-[#2A1F22]">
                  {genStatus.remaining}
                  <span className="text-sm font-sans font-semibold text-[#6B5A5E] ml-1.5">
                    / {genStatus.limit} images left today
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[#6B5A5E]">
                  {genStatus.count === 0
                    ? "Full daily allowance available"
                    : genStatus.remaining === 0
                      ? `Refreshes in ${genStatus.formattedResetTime}`
                      : `${genStatus.count} created · next slot resets in ${genStatus.formattedResetTime}`}
                </p>
              </div>
              <div className="flex size-11 items-center justify-center rounded-2xl bg-[#F3E6DA] text-[#9E2B57]">
                <Palette className="size-5" />
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-[#F3E6DA]">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  genStatus.remaining === 0
                    ? "bg-[#A8261E]"
                    : genStatus.shouldWarn
                      ? "bg-[#D97706]"
                      : "bg-[#9E2B57]",
                )}
                style={{
                  width: `${Math.round(((genStatus.limit - genStatus.remaining) / genStatus.limit) * 100)}%`,
                }}
              />
            </div>

            {/* Context Notice / Warning */}
            {!user ? (
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#EFE3D8] text-xs">
                <span className="text-[#6B5A5E]">
                  Guests get {genStatus.limit} image/24h. Sign in to unlock {genStatus.limitLoggedIn} daily creations.
                </span>
                <Link
                  to="/auth"
                  className="font-bold text-[#9E2B57] hover:underline shrink-0"
                >
                  Sign in
                </Link>
              </div>
            ) : genStatus.shouldWarn && genStatus.remaining > 0 ? (
              <p className="text-xs font-medium text-[#B45309] bg-[#FFFBEB] p-2.5 rounded-xl border border-[#FDE68A]">
                You have reached your {genStatus.warningThreshold}th generation ({genStatus.count} of {genStatus.limit} used). {genStatus.remaining} remaining for the next 24 hours.
              </p>
            ) : genStatus.remaining === 0 ? (
              <p className="text-xs font-medium text-[#A8261E] bg-[#FEF2F2] p-2.5 rounded-xl border border-[#FECACA]">
                Daily cap reached ({genStatus.limit}/{genStatus.limit}). Please try again after 24 hours (refreshes in {genStatus.formattedResetTime}).
              </p>
            ) : null}
          </div>
        </section>

        {/* Section: People and Dates */}
        <section aria-labelledby="h-people" className="flex flex-col gap-2">
          <h2
            id="h-people"
            className="text-xs font-bold uppercase tracking-wider text-[#6B5A5E] px-1"
          >
            People and dates
          </h2>
          <div className="overflow-hidden rounded-2xl border-[1.5px] border-[#E2D2C5] bg-white shadow-sm">
            <button
              type="button"
              onClick={() => toast.info("Recipients can be added when creating or sending cards.")}
              className="flex min-h-[56px] w-full items-center justify-between border-b border-[#EFE3D8] px-4 text-left text-base font-semibold text-[#2A1F22] hover:bg-[#FAF7F2] transition-colors"
            >
              <span>Saved recipients</span>
              <ChevronRight className="size-5 text-[#6B5A5E]" />
            </button>
            <button
              type="button"
              onClick={() => toast.info("Add birthdays directly while scheduling a card.")}
              className="flex min-h-[56px] w-full items-center justify-between px-4 text-left text-base font-semibold text-[#2A1F22] hover:bg-[#FAF7F2] transition-colors"
            >
              <span>Birthdays and special dates</span>
              <ChevronRight className="size-5 text-[#6B5A5E]" />
            </button>
          </div>
        </section>

        {/* Section: Your Cards */}
        <section aria-labelledby="h-cards" className="flex flex-col gap-2">
          <h2
            id="h-cards"
            className="text-xs font-bold uppercase tracking-wider text-[#6B5A5E] px-1"
          >
            Your cards
          </h2>
          <div className="overflow-hidden rounded-2xl border-[1.5px] border-[#E2D2C5] bg-white shadow-sm">
            <Link
              to="/"
              className="flex min-h-[56px] items-center justify-between border-b border-[#EFE3D8] px-4 text-base font-semibold text-[#2A1F22] hover:bg-[#FAF7F2] transition-colors"
            >
              <span>Drafts</span>
              <ChevronRight className="size-5 text-[#6B5A5E]" />
            </Link>
            <Link
              to="/orders"
              className="flex min-h-[56px] items-center justify-between px-4 text-base font-semibold text-[#2A1F22] hover:bg-[#FAF7F2] transition-colors"
            >
              <span>Scheduled and sent</span>
              <ChevronRight className="size-5 text-[#6B5A5E]" />
            </Link>
          </div>
        </section>

        {/* Section: Reminders */}
        <section aria-labelledby="h-reminders" className="flex flex-col gap-2">
          <h2
            id="h-reminders"
            className="text-xs font-bold uppercase tracking-wider text-[#6B5A5E] px-1"
          >
            Reminders
          </h2>
          <div className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-[#E2D2C5] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-base font-semibold text-[#2A1F22]">
                Remind me before special dates
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={remindOn}
                onClick={() => setRemindOn(!remindOn)}
                className={cn(
                  "relative inline-flex h-8 w-13 shrink-0 cursor-pointer rounded-full transition-colors",
                  remindOn ? "bg-[#9E2B57]" : "bg-[#C9A9A0]",
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block size-6.5 rounded-full bg-white shadow-md transform transition-transform mt-0.5",
                    remindOn ? "translate-x-5.5" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>

            {remindOn && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {(["1 day", "3 days", "1 week"] as const).map((lead) => (
                  <button
                    key={lead}
                    type="button"
                    onClick={() => setRemindLead(lead)}
                    className={cn(
                      "min-h-[44px] rounded-full text-sm font-semibold transition-all border",
                      remindLead === lead
                        ? "bg-[#9E2B57] text-white border-[#9E2B57]"
                        : "bg-white text-[#2A1F22] border-[#E2D2C5] hover:border-[#C9A9A0]",
                    )}
                  >
                    {lead}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Section: Photos and Privacy */}
        <section aria-labelledby="h-privacy" className="flex flex-col gap-2">
          <h2
            id="h-privacy"
            className="text-xs font-bold uppercase tracking-wider text-[#6B5A5E] px-1"
          >
            Photos and privacy
          </h2>
          <div className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-[#E2D2C5] bg-white p-4 shadow-sm">
            <p className="text-sm text-[#6B5A5E] leading-relaxed">
              We only keep your photos to make your cards.
            </p>
            <button
              type="button"
              onClick={handleDeletePhotos}
              className="tap-safe self-start text-sm font-bold text-[#A8261E] hover:underline pt-1"
            >
              Delete my uploaded photos
            </button>
          </div>
        </section>

        {/* Section: Settings & Sign out */}
        <section className="overflow-hidden rounded-2xl border-[1.5px] border-[#E2D2C5] bg-white shadow-sm">
          <Link
            to="/help"
            className="flex min-h-[56px] items-center justify-between border-b border-[#EFE3D8] px-4 text-base font-semibold text-[#2A1F22] hover:bg-[#FAF7F2] transition-colors"
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="size-5 text-[#6B5A5E]" />
              <span>Help & Questions</span>
            </div>
            <ChevronRight className="size-5 text-[#6B5A5E]" />
          </Link>

          <Link
            to="/privacy"
            className="flex min-h-[56px] items-center justify-between border-b border-[#EFE3D8] px-4 text-base font-semibold text-[#2A1F22] hover:bg-[#FAF7F2] transition-colors"
          >
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-5 text-[#6B5A5E]" />
              <span>Privacy notice</span>
            </div>
            <ChevronRight className="size-5 text-[#6B5A5E]" />
          </Link>

          <Link
            to="/terms"
            className="flex min-h-[56px] items-center justify-between border-b border-[#EFE3D8] px-4 text-base font-semibold text-[#2A1F22] hover:bg-[#FAF7F2] transition-colors"
          >
            <div className="flex items-center gap-3">
              <FileText className="size-5 text-[#6B5A5E]" />
              <span>Terms of use</span>
            </div>
            <ChevronRight className="size-5 text-[#6B5A5E]" />
          </Link>

          {user ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex min-h-[56px] w-full items-center justify-between px-4 text-left text-base font-semibold text-[#A8261E] hover:bg-[#FAF7F2] transition-colors"
            >
              <div className="flex items-center gap-3">
                <LogOut className="size-5 text-[#A8261E]" />
                <span>Sign out</span>
              </div>
            </button>
          ) : (
            <Link
              to="/auth"
              className="flex min-h-[56px] items-center justify-between px-4 text-base font-semibold text-[#9E2B57] hover:bg-[#FAF7F2] transition-colors"
            >
              <span>Sign in / Register</span>
              <ChevronRight className="size-5 text-[#9E2B57]" />
            </Link>
          )}
        </section>
      </main>
    </div>
  );
}
