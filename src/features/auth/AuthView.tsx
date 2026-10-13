import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Mail,
  Lock,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/features/auth/auth-context";
import { useT } from "@/i18n/i18n";
import { cn } from "@/lib/utils";

interface AuthViewProps {
  initialMode?: "signin" | "signup" | "recovery" | "reset-password";
  redirectPath?: string;
  onSuccess?: () => void;
  allowGuestBypass?: boolean;
}

export function AuthView({
  initialMode = "signin",
  redirectPath = "/",
  onSuccess,
  allowGuestBypass = true,
}: AuthViewProps) {
  const navigate = useNavigate();
  const t = useT();
  const {
    user,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    resetPassword,
    updatePassword,
    resendVerificationEmail,
  } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup" | "recovery" | "reset-password">(
    initialMode,
  );

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Loading & status flags
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailNeedsConfirmation, setEmailNeedsConfirmation] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [isResending, setIsResending] = useState(false);

  function handleSuccess() {
    if (onSuccess) {
      onSuccess();
    } else {
      void navigate({ to: redirectPath as string });
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await signInWithEmail(email, password);
    setIsSubmitting(false);

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("email not confirmed") || msg.includes("not verified")) {
        setPendingEmail(email);
        setEmailNeedsConfirmation(true);
      } else if (msg.includes("invalid login credentials")) {
        setErrorMessage("Invalid email or password. Please check your credentials.");
      } else {
        setErrorMessage(error.message);
      }
      return;
    }

    toast.success("Signed in successfully");
    handleSuccess();
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage("Please provide an email and password.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const { error, needsEmailConfirmation } = await signUpWithEmail(email, password, fullName);
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (needsEmailConfirmation) {
      setPendingEmail(email);
      setEmailNeedsConfirmation(true);
      toast.info("Please check your email to confirm registration");
    } else {
      toast.success("Account created successfully");
      handleSuccess();
    }
  }

  async function handleRecovery(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!email) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await resetPassword(email);
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setResetSent(true);
    toast.success(t("auth.resetLinkSent"));
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!password) {
      setErrorMessage("Please enter a new password.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await updatePassword(password);
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    toast.success(t("auth.passwordUpdated"));
    handleSuccess();
  }

  async function handleResendVerification() {
    const targetEmail = pendingEmail || email;
    if (!targetEmail) return;

    setIsResending(true);
    const { error } = await resendVerificationEmail(targetEmail);
    setIsResending(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(t("auth.resendSuccess"));
    }
  }

  // View: Email Confirmation Notice
  if (emailNeedsConfirmation) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#FBF5EE] px-4 py-8 text-[#2A1F22]">
        <div className="w-full max-w-md rounded-3xl border border-[#E2D2C5] bg-white p-6 sm:p-8 text-center shadow-md">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#F3E6DA] text-[#9E2B57]">
            <CheckCircle2 className="size-8" />
          </div>
          <h2 className="mt-4 font-serif text-2xl font-normal text-[#2A1F22]">
            {t("auth.checkEmailTitle")}
          </h2>
          <p className="mt-2 text-sm text-[#6B5A5E] leading-relaxed">
            {t("auth.checkEmailDescription", { email: pendingEmail })}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={isResending}
              onClick={handleResendVerification}
              className="h-12 rounded-xl border-[#C9A9A0] font-semibold"
            >
              {isResending ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              {t("auth.resendButton")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEmailNeedsConfirmation(false);
                setMode("signin");
              }}
              className="h-10 text-[#6B5A5E] hover:text-[#2A1F22]"
            >
              <ArrowLeft className="size-4 mr-2" />
              {t("auth.backToSignIn")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // View: Already Signed In
  if (user) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#FBF5EE] px-4 py-8 text-[#2A1F22]">
        <div className="w-full max-w-md rounded-3xl border border-[#E2D2C5] bg-white p-6 sm:p-8 text-center shadow-md">
          <h2 className="font-serif text-2xl font-normal text-[#2A1F22]">
            {t("auth.alreadySignedIn")}
          </h2>
          <p className="mt-2 text-sm text-[#6B5A5E]">
            {t("auth.signedInAs", { email: user.email || "" })}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Button
              type="button"
              onClick={handleSuccess}
              className="h-12 rounded-2xl bg-[#9E2B57] hover:bg-[#852243] text-white font-bold"
            >
              {t("auth.continueToApp")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void signOut()}
              className="h-12 rounded-2xl border-[#C9A9A0] font-semibold"
            >
              {t("auth.signOut")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-[#FBF5EE] text-[#2A1F22] selection:bg-[#9E2B57]/15">
      <div className="w-full max-w-[420px] flex flex-col min-h-screen bg-[#FBF5EE] shadow-[0_0_40px_rgba(42,31,34,0.06)]">
        {/* Top Hero Banner with Floating Cards & App Icon */}
        <section
          aria-label="Brand Hero"
          className="relative flex flex-col items-center justify-center overflow-hidden rounded-b-[40px] bg-[#F3E6DA] pt-12 pb-10 px-6 gap-3.5"
        >
          {/* Decorative Floating Cards matching redesign */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-8 top-10 h-36 w-24 -rotate-14 rounded-2xl bg-[#BFC6E6] shadow-sm"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 top-14 h-24 w-32 rotate-12 rounded-2xl bg-[#E9B8A0] shadow-sm"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute right-8 -bottom-6 h-20 w-20 -rotate-8 rounded-2xl bg-[#BFD3C8] shadow-sm"
          />

          {/* Official App Icon SVG */}
          <svg
            width="84"
            height="84"
            viewBox="0 0 64 64"
            role="img"
            aria-label="Dearly Studio"
            className="relative drop-shadow-[0_12px_22px_rgba(158,43,87,0.32)]"
          >
            <rect width="64" height="64" rx="16" fill="#9E2B57" />
            <g transform="rotate(-8 32 32)">
              <path
                d="M17 14h22l8 8v28a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3V17a3 3 0 0 1 3-3z"
                fill="#FFFFFF"
              />
              <path d="M39 14l8 8h-5a3 3 0 0 1-3-3z" fill="#E9B8A0" />
              <path
                d="M31 44c-5.500-3.600-8.500-6.500-8.500-9.800 0-2.400 1.800-4.200 4-4.200 1.700 0 3.400 1 4.500 2.700 1.100-1.700 2.800-2.700 4.500-2.700 2.200 0 4 1.800 4 4.200 0 3.300-3 6.200-8.500 9.800z"
                fill="#9E2B57"
              />
            </g>
          </svg>

          <div className="relative font-serif text-[32px] sm:text-[34px] tracking-tight text-[#2A1F22] font-normal">
            Dearly Studio
          </div>
        </section>

        {/* Form Body */}
        <main className="flex-1 px-6 pt-6 pb-4 flex flex-col gap-4">
          <div>
            <h1 className="font-serif text-[24px] sm:text-[26px] font-normal leading-tight text-[#2A1F22]">
              Turn one photo into a card or art they will keep
            </h1>
            <p className="mt-2 text-sm text-[#6B5A5E] leading-relaxed">
              Sign in to save your cards and schedule them ahead of time.
            </p>
          </div>

          {/* Feedback & Error alerts */}
          {errorMessage && (
            <Alert
              variant="destructive"
              className="rounded-xl border-[#A8261E]/30 bg-[#A8261E]/10 text-[#A8261E] py-2.5"
            >
              <AlertCircle className="size-4" />
              <AlertDescription className="text-xs sm:text-sm font-medium">
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}

          {resetSent && (
            <Alert className="rounded-xl border-[#2E7D32]/30 bg-[#2E7D32]/10 text-[#2E7D32] py-2.5">
              <CheckCircle2 className="size-4" />
              <AlertTitle className="text-xs sm:text-sm font-bold">
                {t("auth.resetSentTitle")}
              </AlertTitle>
              <AlertDescription className="text-xs">
                {t("auth.resetSentDescription")}
              </AlertDescription>
            </Alert>
          )}

          {/* Recovery / Reset Mode */}
          {mode === "recovery" && (
            <form onSubmit={handleRecovery} className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="recovery-email" className="text-sm font-semibold text-[#2A1F22]">
                  {t("auth.email")}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 size-4 text-[#6B5A5E] pointer-events-none" />
                  <Input
                    id="recovery-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="h-12 pl-10 rounded-xl border-[1.5px] border-[#C9A9A0] bg-white text-base focus-visible:border-[#9E2B57] focus-visible:ring-1 focus-visible:ring-[#9E2B57]"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-13 rounded-2xl bg-[#9E2B57] hover:bg-[#852243] text-white font-bold text-base shadow-sm"
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin mr-2" />}
                {t("auth.sendResetLink")}
              </Button>
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-xs font-semibold text-[#6B5A5E] hover:text-[#2A1F22] py-1 text-center"
              >
                ← {t("auth.backToSignIn")}
              </button>
            </form>
          )}

          {/* Reset Password Form */}
          {mode === "reset-password" && (
            <form onSubmit={handleResetPassword} className="flex flex-col gap-3.5 mt-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-password" className="text-sm font-semibold text-[#2A1F22]">
                  {t("auth.newPassword")}
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="h-12 rounded-xl border-[1.5px] border-[#C9A9A0] bg-white"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm-new-pass" className="text-sm font-semibold text-[#2A1F22]">
                  {t("auth.confirmPassword")}
                </Label>
                <Input
                  id="confirm-new-pass"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="h-12 rounded-xl border-[1.5px] border-[#C9A9A0] bg-white"
                />
              </div>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-13 rounded-2xl bg-[#9E2B57] hover:bg-[#852243] text-white font-bold"
              >
                {isSubmitting && <Loader2 className="size-4 animate-spin mr-2" />}
                {t("auth.updatePasswordButton")}
              </Button>
            </form>
          )}

          {/* Main Auth View: Sign In vs Register Switcher */}
          {(mode === "signin" || mode === "signup") && (
            <div className="flex flex-col gap-4">
              {/* Segmented Pill Selector: Sign In vs Register */}
              <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[#F3E6DA] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setMode("signin");
                  }}
                  className={cn(
                    "min-h-[44px] rounded-xl text-sm font-bold transition-all",
                    mode === "signin"
                      ? "bg-white text-[#2A1F22] shadow-[0_1px_3px_rgba(42,31,34,0.12)]"
                      : "text-[#6B5A5E] hover:text-[#2A1F22]",
                  )}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setMode("signup");
                  }}
                  className={cn(
                    "min-h-[44px] rounded-xl text-sm font-bold transition-all",
                    mode === "signup"
                      ? "bg-white text-[#2A1F22] shadow-[0_1px_3px_rgba(42,31,34,0.12)]"
                      : "text-[#6B5A5E] hover:text-[#2A1F22]",
                  )}
                >
                  Register
                </button>
              </div>

              {/* Sign In Form */}
              {mode === "signin" && (
                <form onSubmit={handleSignIn} className="flex flex-col gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="signin-email" className="text-sm font-semibold text-[#2A1F22]">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 size-4 text-[#6B5A5E] pointer-events-none" />
                      <Input
                        id="signin-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="h-12 pl-10 rounded-xl border-[1.5px] border-[#C9A9A0] bg-white text-base focus-visible:border-[#9E2B57] focus-visible:ring-1 focus-visible:ring-[#9E2B57]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="signin-password"
                        className="text-sm font-semibold text-[#2A1F22]"
                      >
                        Password
                      </Label>
                      <button
                        type="button"
                        onClick={() => setMode("recovery")}
                        className="text-xs font-semibold text-[#9E2B57] hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 size-4 text-[#6B5A5E] pointer-events-none" />
                      <Input
                        id="signin-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="h-12 pl-10 pr-10 rounded-xl border-[1.5px] border-[#C9A9A0] bg-white text-base focus-visible:border-[#9E2B57] focus-visible:ring-1 focus-visible:ring-[#9E2B57]"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-[#6B5A5E] hover:text-[#2A1F22]"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-14 mt-1 rounded-2xl bg-[#9E2B57] hover:bg-[#852243] text-white font-bold text-base shadow-[0_4px_12px_rgba(158,43,87,0.22)]"
                  >
                    {isSubmitting && <Loader2 className="size-4 animate-spin mr-2" />}
                    Sign in with email
                  </Button>
                </form>
              )}

              {/* Register / Sign Up Form */}
              {mode === "signup" && (
                <form onSubmit={handleSignUp} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="signup-name" className="text-sm font-semibold text-[#2A1F22]">
                      Full name
                    </Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-3.5 size-4 text-[#6B5A5E] pointer-events-none" />
                      <Input
                        id="signup-name"
                        type="text"
                        autoComplete="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Your name"
                        className="h-12 pl-10 rounded-xl border-[1.5px] border-[#C9A9A0] bg-white text-base focus-visible:border-[#9E2B57] focus-visible:ring-1 focus-visible:ring-[#9E2B57]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="signup-email" className="text-sm font-semibold text-[#2A1F22]">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 size-4 text-[#6B5A5E] pointer-events-none" />
                      <Input
                        id="signup-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="h-12 pl-10 rounded-xl border-[1.5px] border-[#C9A9A0] bg-white text-base focus-visible:border-[#9E2B57] focus-visible:ring-1 focus-visible:ring-[#9E2B57]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label
                      htmlFor="signup-password"
                      className="text-sm font-semibold text-[#2A1F22]"
                    >
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 size-4 text-[#6B5A5E] pointer-events-none" />
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="h-12 pl-10 pr-10 rounded-xl border-[1.5px] border-[#C9A9A0] bg-white text-base focus-visible:border-[#9E2B57] focus-visible:ring-1 focus-visible:ring-[#9E2B57]"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-[#6B5A5E] hover:text-[#2A1F22]"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label
                      htmlFor="signup-confirm-password"
                      className="text-sm font-semibold text-[#2A1F22]"
                    >
                      Confirm password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 size-4 text-[#6B5A5E] pointer-events-none" />
                      <Input
                        id="signup-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat your password"
                        className="h-12 pl-10 pr-10 rounded-xl border-[1.5px] border-[#C9A9A0] bg-white text-base focus-visible:border-[#9E2B57] focus-visible:ring-1 focus-visible:ring-[#9E2B57]"
                      />
                      <button
                        type="button"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-3.5 text-[#6B5A5E] hover:text-[#2A1F22]"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-14 mt-1 rounded-2xl bg-[#9E2B57] hover:bg-[#852243] text-white font-bold text-base shadow-[0_4px_12px_rgba(158,43,87,0.22)]"
                  >
                    {isSubmitting && <Loader2 className="size-4 animate-spin mr-2" />}
                    Create your account
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* Guest preview bypass link */}
          {allowGuestBypass && (
            <button
              type="button"
              onClick={handleSuccess}
              className="tap-safe mx-auto py-2 text-center text-sm font-semibold text-[#9E2B57] hover:underline"
            >
              Try a preview first. No sign-in needed.
            </button>
          )}
        </main>

        {/* Footer info & legal */}
        <footer className="mt-auto px-6 pt-3 pb-8 text-center text-xs text-[#6B5A5E] leading-relaxed">
          <p>
            By continuing you agree to our{" "}
            <Link to="/terms" className="underline hover:text-[#2A1F22]">
              Terms
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="underline hover:text-[#2A1F22]">
              Privacy Policy
            </Link>
            . We only keep your photos to make your cards.
          </p>
        </footer>
      </div>
    </div>
  );
}
