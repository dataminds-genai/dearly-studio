import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/layout/Page";
import { galleryItems } from "@/domain/samples";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/i18n";

import { buildMetaTags, getBreadcrumbSchema, SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/gallery")({
  head: () =>
    buildMetaTags({
      title: "Inspiration Gallery — Real Custom Cards & Art Prints | Dearly Studio",
      description:
        "Browse sample custom cards and artistic photo prints made from real photos of family, pets, and travels. See watercolor, sketch, impressionist and original styles.",
      keywords: [
        "photo card samples",
        "AI art gallery",
        "custom card examples",
        "photo to watercolor examples",
        "pet portrait cards",
      ],
      path: "/gallery",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Dearly Studio Inspiration Gallery",
          description: "Sample cards and art prints created from real photos.",
          url: `${SITE_URL}/gallery`,
        },
        getBreadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Gallery", path: "/gallery" },
        ]),
      ],
    }),
  component: Gallery,
});

function Gallery() {
  const t = useT();
  const categoryLabels: Record<string, string> = {
    people: t("gallery.category.people"),
    pets: t("gallery.category.pets"),
    places: t("gallery.category.places"),
  };
  const categories = ["all", ...Array.from(new Set(galleryItems.map((item) => item.category)))];
  const [active, setActive] = useState("all");
  const visible =
    active === "all" ? galleryItems : galleryItems.filter((i) => i.category === active);

  return (
    <Page wide title={t("gallery.title")} intro={t("gallery.intro")}>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter gallery by category">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            aria-pressed={active === category}
            onClick={() => setActive(category)}
            className={cn(
              "tap-safe rounded-full border px-4 py-2 text-sm",
              active === category
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-primary/50",
            )}
          >
            {category === "all"
              ? t("gallery.category.all")
              : (categoryLabels[category] ?? category)}
          </button>
        ))}
      </div>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => (
          <li key={item.id} className="overflow-hidden rounded-xl border border-border bg-card">
            <img
              src={item.src}
              alt={`${item.label} — sample photo shown as a finished card`}
              width={1024}
              height={1024}
              loading="lazy"
              className="aspect-square w-full object-cover"
            />
            <div className="p-4">
              <p className="font-semibold">{item.label}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {item.styleLabel} · {categoryLabels[item.category] ?? item.category}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{item.suggestedMessage}</p>
            </div>
          </li>
        ))}
      </ul>

      <Button asChild size="lg" className="tap-safe mt-8">
        <Link to="/create">{t("gallery.cta.create")}</Link>
      </Button>
    </Page>
  );
}
