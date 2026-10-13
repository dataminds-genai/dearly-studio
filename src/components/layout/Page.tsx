import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

export function Page({
  title,
  intro,
  children,
  className,
  wide,
  backTo = "/account",
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
  wide?: boolean;
  backTo?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-md flex-col bg-[#FBF5EE] text-[#2A1F22] px-4 pb-12 pt-4",
        wide && "max-w-xl",
        className,
      )}
    >
      <header className="mb-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Link
            to={backTo}
            className="flex size-11 items-center justify-center rounded-2xl border border-[#E2D2C5] bg-white text-[#2A1F22] shadow-sm hover:bg-[#F3E6DA] transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <Logo className="size-7" />
            <span className="font-serif text-xl font-bold tracking-tight text-[#2A1F22]">
              Dearly Studio
            </span>
          </Link>
          <div className="size-11" />
        </div>
        <div className="pt-2">
          <h1 className="font-serif text-[28px] font-normal tracking-tight text-[#2A1F22] leading-tight">
            {title}
          </h1>
          {intro ? (
            <div className="mt-1 text-sm text-[#6B5A5E] leading-relaxed">{intro}</div>
          ) : null}
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-[#2A1F22]/90 [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#2A1F22] [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-[#2A1F22] [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
      {children}
    </div>
  );
}
