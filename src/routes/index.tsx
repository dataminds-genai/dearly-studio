import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { QuickCreate } from "@/features/creation/QuickCreate";
import { AuthView } from "@/features/auth/AuthView";
import { useAuth } from "@/features/auth/auth-context";

import { buildMetaTags, getWebApplicationSchema } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () =>
    buildMetaTags({
      title: "Dearly Studio | AI Custom Photo Cards, Art Prints & Framing",
      description:
        "Transform photos into museum-quality greeting cards, watercolor art, and framed physical prints. Free instant preview, thoughtful messages & worldwide delivery.",
      keywords: [
        "custom photo cards",
        "personalized greeting cards",
        "photo to art",
        "turn photos into paintings",
        "custom framed prints",
        "watercolor cards",
        "anniversary cards",
        "birthday cards",
        "postcard printing",
      ],
      path: "/",
      jsonLd: getWebApplicationSchema(),
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
