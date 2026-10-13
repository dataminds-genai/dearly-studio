import { Link } from "@tanstack/react-router";
import { ShoppingBag, User as UserIcon, LogOut, Package, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/layout/Logo";
import { useStore } from "@/features/creation/creation-store";
import { useAuth } from "@/features/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { useT } from "@/i18n/i18n";

const links = [
  { to: "/create", key: "nav.create" },
  { to: "/how-it-works", key: "nav.howItWorks" },
  { to: "/gallery", key: "nav.gallery" },
  { to: "/pricing", key: "nav.pricing" },
  { to: "/library", key: "nav.library" },
] as const;

export function SiteHeader() {
  const { cart } = useStore();
  const { user, profile, signOut } = useAuth();
  const t = useT();
  const count = cart.reduce((n, item) => n + item.quantity, 0);

  const initials = (profile?.fullName || user?.email || "U").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:h-16 sm:gap-3">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2 rounded-md py-1 pr-1"
          aria-label="Dearly Studio home"
        >
          <Logo className="size-9 text-primary" />
          <span className="truncate whitespace-nowrap font-serif text-base font-semibold sm:text-lg">
            Dearly Studio
          </span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-2">
          <LanguageSwitcher className="tap-safe h-10 w-auto gap-1 px-2 sm:gap-2 sm:px-3 [&>span]:hidden sm:[&>span]:block" />

          <Button asChild variant="ghost" size="icon" className="tap-safe relative">
            <Link to="/cart" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
              <ShoppingBag className="size-5" aria-hidden="true" />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                  {count}
                </span>
              )}
            </Link>
          </Button>

          {/* User Auth Dropdown or Sign In CTA */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="tap-safe relative rounded-full">
                  <Avatar className="size-8 border border-border">
                    {profile?.avatarUrl && (
                      <AvatarImage
                        src={profile.avatarUrl}
                        alt={profile.fullName || user.email || ""}
                      />
                    )}
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="sr-only">Open user menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold leading-none">
                      {profile?.fullName || "Dearly Creator"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/account" className="cursor-pointer gap-2">
                    <UserIcon className="size-4" />
                    <span>{t("nav.account")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/library" className="cursor-pointer gap-2">
                    <ImageIcon className="size-4" />
                    <span>{t("nav.library")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/orders" className="cursor-pointer gap-2">
                    <Package className="size-4" />
                    <span>{t("nav.orders")}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    toast.success("Signed out");
                  }}
                  className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                >
                  <LogOut className="size-4" />
                  <span>{t("auth.signOut")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="tap-safe hidden sm:inline-flex text-xs"
            >
              <Link to="/auth">{t("auth.signInButton")}</Link>
            </Button>
          )}

          <Button asChild className="tap-safe hidden sm:inline-flex">
            <Link to="/create">{t("cta.createFromPhoto")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
