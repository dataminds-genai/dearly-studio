import { createFileRoute } from "@tanstack/react-router";
import { QuickCreate } from "@/features/creation/QuickCreate";

import { buildMetaTags, getBreadcrumbSchema, getWebApplicationSchema } from "@/lib/seo";

export const Route = createFileRoute("/create/")({
  head: () =>
    buildMetaTags({
      title: "Create Custom Greeting Cards & Art Prints Online | Dearly Studio",
      description:
        "Upload a photo and create your personalized greeting card, postcard, or framed art print now. Instant free preview, artistic styles, custom wording.",
      keywords: [
        "create custom cards",
        "make photo cards online",
        "turn photo into print",
        "personalized greeting card maker",
      ],
      path: "/create",
      jsonLd: [
        getWebApplicationSchema(),
        getBreadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Create", path: "/create" },
        ]),
      ],
    }),
  component: QuickCreate,
});
