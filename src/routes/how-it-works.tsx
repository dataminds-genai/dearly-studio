import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/layout/Page";
import { UPLOAD_PRIVACY_NOTICE } from "@/domain/content";
import { useT } from "@/i18n/i18n";

import { buildMetaTags, getBreadcrumbSchema, getHowToSchema } from "@/lib/seo";

export const Route = createFileRoute("/how-it-works")({
  head: () =>
    buildMetaTags({
      title: "How It Works — Custom Photo Cards in 5 Easy Steps | Dearly Studio",
      description:
        "Learn how Dearly Studio turns any photo into a custom printed card or framed art in minutes: upload photo, personalize words, pick an artistic style, and order.",
      keywords: [
        "how to create photo cards",
        "turn photo into postcard",
        "custom greeting card steps",
        "order photo prints online",
        "photo to watercolor process",
      ],
      path: "/how-it-works",
      jsonLd: [
        getHowToSchema(),
        getBreadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "How It Works", path: "/how-it-works" },
        ]),
      ],
    }),
  component: HowItWorks,
});

const stepIds = ["addPhoto", "chooseWords", "chooseLook", "checkIt", "sendOrOrder"] as const;

function HowItWorks() {
  const t = useT();
  // The domain notice below is fixed marketing copy; it is mapped to a translated key here.
  void UPLOAD_PRIVACY_NOTICE;

  return (
    <Page title={t("howItWorks.title")} intro={t("howItWorks.intro")}>
      <ol className="space-y-5">
        {stepIds.map((id, index) => (
          <li
            key={id}
            id={`step-${index + 1}`}
            className="rounded-xl border border-border bg-card p-5 scroll-mt-20"
          >
            <h2 className="text-lg">{t(`howItWorks.step.${id}.title`)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t(`howItWorks.step.${id}.body`)}</p>
          </li>
        ))}
      </ol>

      <section className="mt-8 rounded-xl border border-border bg-paper p-5">
        <h2 className="text-lg">{t("howItWorks.privacyHeading")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("howItWorks.privacyNotice")}</p>
        <Button asChild variant="outline" className="tap-safe mt-4">
          <Link to="/privacy">{t("howItWorks.readPrivacy")}</Link>
        </Button>
      </section>

      <Button asChild size="lg" className="tap-safe mt-8">
        <Link to="/create">{t("howItWorks.cta.create")}</Link>
      </Button>
    </Page>
  );
}
