import { createFileRoute } from "@tanstack/react-router";
import { QuickCreate } from "@/features/creation/QuickCreate";

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
  component: QuickCreate,
});
