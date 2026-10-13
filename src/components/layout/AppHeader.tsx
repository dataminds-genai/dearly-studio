import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

/** Shared app header: Dearly Studio brand on the left, optional trailing slot on the right. */
export function AppHeader({ trailing }: { trailing?: ReactNode }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between px-4 pt-1">
      <Link to="/" className="flex items-center gap-2" aria-label="Dearly Studio home">
        <Logo size={28} />
        <span className="font-serif text-[22px] font-normal tracking-tight text-[#2A1F22]">
          Dearly Studio
        </span>
      </Link>
      {trailing}
    </header>
  );
}
