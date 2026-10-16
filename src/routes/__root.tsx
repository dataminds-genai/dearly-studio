import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { lazy, useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CreationStoreProvider } from "@/features/creation/creation-store";
import { AuthProvider, useAuth } from "@/features/auth/auth-context";
import { I18nProvider } from "@/i18n/i18n";
import { BottomNav } from "@/components/layout/BottomNav";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: unknown }) {
  console.error(error);
  const router = useRouter();
  const err = error instanceof Error ? error : new Error(String(error));
  useEffect(() => {
    reportLovableError(err, { boundary: "tanstack_root_error_component" });
  }, [err]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              void router.invalidate();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#FBF5EE" },
      { title: "Dearly Studio — AI Custom Photo Cards, Art Prints & Framing" },
      {
        name: "description",
        content:
          "Transform personal photos into heartfelt greeting cards, watercolor art, and framed physical prints. Free instant preview, no sign-up required.",
      },
      { property: "og:site_name", content: "Dearly Studio" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "en_US" },
      { property: "og:image", content: "https://dearly-studio.site/og-image.png" },
      { property: "og:image:width", content: "960" },
      { property: "og:image:height", content: "600" },
      { property: "og:image:alt", content: "Dearly Studio — Cards and art prints from your photos" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://dearly-studio.site/og-image.png" },
    ],
    links: [
      { rel: "canonical", href: "https://dearly-studio.site" },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Gloock&family=Figtree:ital,wght@0,400..700;1,400..700&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Caveat:wght@500;700&display=swap",
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "shortcut icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Dearly Studio",
          url: "https://dearly-studio.site",
          logo: "https://dearly-studio.site/icon-512.png",
          image: "https://dearly-studio.site/og-image.png",
          description:
            "Dearly Studio turns personal photos into custom greeting cards, artistic photo prints, and framed keepsakes with instant previews and worldwide delivery.",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Dearly Studio",
          url: "https://dearly-studio.site",
          description: "Turn one photo into a card or art they will keep.",
          inLanguage: ["en", "ar"],
          potentialAction: {
            "@type": "CreateAction",
            name: "Create a Custom Card or Print",
            target: "https://dearly-studio.site/create",
          },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: lazy(() => Promise.resolve({ default: ErrorComponent })),
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootLayoutContent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    const updateGuest = () => {
      try {
        if (typeof window !== "undefined") {
          setIsGuest(sessionStorage.getItem("dearly_guest_preview") === "true");
        }
      } catch {
        // ignore
      }
    };
    updateGuest();
    window.addEventListener("dearly_auth_changed", updateGuest);
    return () => window.removeEventListener("dearly_auth_changed", updateGuest);
  }, [user]);

  const isAuthPage =
    pathname === "/auth" ||
    pathname.startsWith("/auth") ||
    (pathname === "/" && !user && !isGuest);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <main
        id="main"
        className={cn(
          "min-h-screen bg-[#FBF5EE]",
          !isAuthPage && "pb-20",
        )}
      >
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </main>
      {!isAuthPage ? <BottomNav /> : null}
      <Toaster />
    </>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <I18nProvider>
          <CreationStoreProvider>
            <RootLayoutContent />
          </CreationStoreProvider>
        </I18nProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
