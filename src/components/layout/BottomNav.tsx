import { Link, useRouterState } from "@tanstack/react-router";
import { PlusSquare, Calendar, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Hide completely on login/auth routes
  if (pathname === "/auth" || pathname.startsWith("/auth")) {
    return null;
  }

  const isCreate = pathname === "/" || pathname.startsWith("/create");
  const isScheduled = pathname.startsWith("/orders");
  const isProfile = pathname.startsWith("/account");

  const navItems = [
    {
      to: "/",
      label: "Create",
      active: isCreate,
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-6 shrink-0"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      ),
    },
    {
      to: "/orders",
      label: "Scheduled",
      active: isScheduled,
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-6 shrink-0"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      ),
    },
    {
      to: "/account",
      label: "Profile",
      active: isProfile,
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-6 shrink-0"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
        </svg>
      ),
    },
  ];

  return (
    <nav
      aria-label="Bottom Navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E6D8CC] bg-[#FBF5EE]/95 backdrop-blur-md safe-bottom shadow-[0_-4px_16px_rgba(42,31,34,0.04)]"
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-4 py-1.5">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "tap-safe flex flex-1 flex-col items-center justify-center gap-1 py-1 text-xs transition-colors",
              item.active
                ? "font-bold text-[#9E2B57]"
                : "font-semibold text-[#6B5A5E] hover:text-[#2A1F22]",
            )}
            aria-current={item.active ? "page" : undefined}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
