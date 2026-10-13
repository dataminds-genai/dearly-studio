import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { QuickCreate } from "@/features/creation/QuickCreate";
import { AuthView } from "@/features/auth/AuthView";
import { useAuth } from "@/features/auth/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dearly Studio — Turn one photo into a card they will keep" },
      {
        name: "description",
        content:
          "Create and share a personal card from one photo. Preview for free. No card required.",
      },
      { property: "og:title", content: "Dearly Studio" },
      {
        property: "og:description",
        content: "Turn one photo and a meaningful message into something ready to share.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const { user } = useAuth();
  const [guestPreview, setGuestPreview] = useState(false);

  useEffect(() => {
    const checkGuest = () => {
      try {
        if (typeof window !== "undefined") {
          setGuestPreview(sessionStorage.getItem("dearly_guest_preview") === "true");
        }
      } catch {
        // ignore
      }
    };
    checkGuest();
    window.addEventListener("dearly_auth_changed", checkGuest);
    return () => window.removeEventListener("dearly_auth_changed", checkGuest);
  }, []);

  // If user is authenticated or guest preview active, show the creator
  if (user || guestPreview) {
    return <QuickCreate />;
  }

  // Initial visit on deployed site loads the Login screen (Screen 0)
  return (
    <AuthView
      initialMode="signin"
      allowGuestBypass={true}
      onSuccess={() => {
        try {
          if (typeof window !== "undefined") {
            sessionStorage.setItem("dearly_guest_preview", "true");
            window.dispatchEvent(new Event("dearly_auth_changed"));
          }
        } catch {
          // ignore
        }
        setGuestPreview(true);
      }}
    />
  );
}
