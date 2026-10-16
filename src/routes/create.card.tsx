import { createFileRoute } from "@tanstack/react-router";
import { CreateFlow } from "@/features/creation/CreateFlow";

import { buildMetaTags, getBreadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/create/card")({
  head: () =>
    buildMetaTags({
      title: "Make a Personalized Digital Greeting Card — Dearly Studio",
      description:
        "Create a heartfelt personalized greeting card from one photo. Share on WhatsApp or by private link with instant free preview.",
      keywords: [
        "create digital greeting card",
        "ecard maker from photo",
        "personalized online card",
        "whatsapp greeting card",
      ],
      path: "/create/card",
      jsonLd: getBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Create", path: "/create" },
        { name: "Digital Card", path: "/create/card" },
      ]),
    }),
  component: () => <CreateFlow presetOutcome="card" />,
});
