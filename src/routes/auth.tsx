import { createFileRoute } from "@tanstack/react-router";
import { AuthView } from "@/features/auth/AuthView";

interface AuthSearchParams {
  mode?: "signin" | "signup" | "recovery" | "reset-password";
  redirect?: string;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearchParams => {
    const rawMode = typeof search["mode"] === "string" ? search["mode"] : "signin";
    const mode = (
      ["signin", "signup", "recovery", "reset-password"].includes(rawMode) ? rawMode : "signin"
    ) as NonNullable<AuthSearchParams["mode"]>;
    const out: AuthSearchParams = { mode };
    if (typeof search["redirect"] === "string") {
      out.redirect = search["redirect"];
    }
    return out;
  },
  head: () => ({
    meta: [
      { title: "Sign in or create account — Dearly Studio" },
      {
        name: "description",
        content: "Sign in to save your cards, access ordered prints, and sync across your devices.",
      },
      { property: "og:title", content: "Sign in — Dearly Studio" },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPageRoute,
});

function AuthPageRoute() {
  const search = Route.useSearch();
  return (
    <AuthView
      initialMode={search.mode || "signin"}
      redirectPath={search.redirect || "/"}
      allowGuestBypass={true}
    />
  );
}
