import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/layout/Page";
import { faqs } from "@/domain/content";
import { useT } from "@/i18n/i18n";

import { buildMetaTags, getBreadcrumbSchema, getFaqSchema } from "@/lib/seo";

export const Route = createFileRoute("/help")({
  head: () =>
    buildMetaTags({
      title: "Help & Frequently Asked Questions | Dearly Studio",
      description:
        "Answers about photos, print resolution checks, delivery times, guest previews, privacy deletion, and custom greeting cards.",
      keywords: [
        "custom card help",
        "photo print resolution guide",
        "card delivery times",
        "dearly studio faq",
        "how to print photos online",
      ],
      path: "/help",
      jsonLd: [
        getFaqSchema(faqs),
        getBreadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Help", path: "/help" },
        ]),
      ],
    }),
  component: Help,
});

function Help() {
  const t = useT();
  const extra = [
    {
      q: t("help.extra.printTooSmall.q"),
      a: t("help.extra.printTooSmall.a"),
    },
    {
      q: t("help.extra.uploadFailed.q"),
      a: t("help.extra.uploadFailed.a"),
    },
    {
      q: t("help.extra.wordingMissing.q"),
      a: t("help.extra.wordingMissing.a"),
    },
    {
      q: t("help.extra.cancelOrder.q"),
      a: t("help.extra.cancelOrder.a"),
    },
    {
      q: t("help.extra.revokeLink.q"),
      a: t("help.extra.revokeLink.a"),
    },
  ];
  return (
    <Page title={t("help.title")} intro={t("help.intro")}>
      <Accordion type="single" collapsible>
        {[...faqs, ...extra].map((faq, index) => (
          <AccordionItem key={faq.q} value={`help-${index}`}>
            <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
            <AccordionContent>{faq.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="mt-8 rounded-xl border border-border bg-paper p-5">
        <h2 className="text-lg">{t("help.stillStuck.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("help.stillStuck.body")}</p>
        <Button asChild variant="outline" className="tap-safe mt-4">
          <Link to="/privacy/request">{t("help.stillStuck.cta")}</Link>
        </Button>
      </div>
    </Page>
  );
}
