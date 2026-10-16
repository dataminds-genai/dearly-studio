import { createFileRoute } from "@tanstack/react-router";
import { CreateFlow } from "@/features/creation/CreateFlow";

import { buildMetaTags, getBreadcrumbSchema } from "@/lib/seo";

export const Route = createFileRoute("/create/print")({
  head: () =>
    buildMetaTags({
      title: "Order Custom Photo Prints & Framed Wall Art — Dearly Studio",
      description:
        "Turn any photo into a museum-quality postcard, archival photo print or framed wall art with automated resolution checks.",
      keywords: [
        "order photo prints",
        "custom postcard printing",
        "framed photo prints online",
        "photo to canvas art",
      ],
      path: "/create/print",
      jsonLd: getBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Create", path: "/create" },
        { name: "Order Prints", path: "/create/print" },
      ]),
    }),
  component: () => <CreateFlow presetOutcome="print" />,
});
