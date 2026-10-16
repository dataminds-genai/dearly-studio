export const SITE_URL = "https://dearly-studio.site";
export const SITE_NAME = "Dearly Studio";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

export interface SeoConfig {
  title: string;
  description: string;
  keywords?: string[];
  path?: string;
  image?: string;
  type?: "website" | "article" | "product";
  robots?: string;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}

export function buildMetaTags(config: SeoConfig) {
  const canonicalUrl = config.path ? `${SITE_URL}${config.path}` : SITE_URL;
  const imageUrl = config.image || DEFAULT_OG_IMAGE;
  const pageType = config.type || "website";

  const meta: Array<Record<string, string>> = [
    { title: config.title },
    { name: "description", content: config.description },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: config.title },
    { property: "og:description", content: config.description },
    { property: "og:type", content: pageType },
    { property: "og:url", content: canonicalUrl },
    { property: "og:image", content: imageUrl },
    { property: "og:image:width", content: "960" },
    { property: "og:image:height", content: "600" },
    { property: "og:image:alt", content: config.title },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: config.title },
    { name: "twitter:description", content: config.description },
    { name: "twitter:image", content: imageUrl },
  ];

  if (config.keywords && config.keywords.length > 0) {
    meta.push({ name: "keywords", content: config.keywords.join(", ") });
  }

  if (config.robots) {
    meta.push({ name: "robots", content: config.robots });
  }

  const links: Array<Record<string, string>> = [
    { rel: "canonical", href: canonicalUrl },
  ];

  const scripts: Array<{ type: string; children: string }> = [];

  if (config.jsonLd) {
    const schemas = Array.isArray(config.jsonLd) ? config.jsonLd : [config.jsonLd];
    for (const schema of schemas) {
      scripts.push({
        type: "application/ld+json",
        children: JSON.stringify(schema),
      });
    }
  }

  return { meta, links, scripts };
}

export function getOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    image: DEFAULT_OG_IMAGE,
    description:
      "Dearly Studio turns personal photos into custom greeting cards, artistic photo prints, and framed keepsakes with instant previews and worldwide delivery.",
    sameAs: [],
  };
}

export function getWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: "Turn one photo into a card or art they will keep.",
    inLanguage: ["en", "ar"],
    potentialAction: {
      "@type": "CreateAction",
      name: "Create a Custom Card or Print",
      target: `${SITE_URL}/create`,
    },
  };
}

export function getWebApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Dearly Studio Card & Art Creator",
    url: SITE_URL,
    applicationCategory: "DesignApplication",
    operatingSystem: "All",
    description:
      "Create custom personalized greeting cards and museum-grade art prints from any photo. Free instant preview, AI art styling, and physical delivery.",
    offers: {
      "@type": "Offer",
      price: "0.00",
      priceCurrency: "USD",
      description: "Free preview, no card required",
    },
    featureList: [
      "AI Art Transformations (Watercolor, Oil, Sketch, Impressionist)",
      "Occasion Cards (Birthdays, Anniversaries, Thank You, Holidays)",
      "High-resolution physical print ordering & framing",
      "Instant free previews without sign up",
    ],
  };
}

export function getHowToSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Create a Custom Card or Art Print with Dearly Studio",
    description:
      "Turn any photo into a custom greeting card or framed art print in five simple steps.",
    totalTime: "PT3M",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Upload a Photo",
        text: "Select a favorite photo of family, friends, pets, or travels from your phone or computer.",
        url: `${SITE_URL}/how-it-works#step-1`,
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Personalize Your Message",
        text: "Choose an occasion, recipient, and tone to craft a meaningful sentiment, or write your own words.",
        url: `${SITE_URL}/how-it-works#step-2`,
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Choose an Artistic Look",
        text: "Keep the original photo or apply artistic styles like watercolor, sketch, oil painting, or impressionism.",
        url: `${SITE_URL}/how-it-works#step-3`,
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Inspect the Real-Size Preview",
        text: "Review the composition, crop, bleed margins, and resolution quality check on screen for free.",
        url: `${SITE_URL}/how-it-works#step-4`,
      },
      {
        "@type": "HowToStep",
        position: 5,
        name: "Send Digitally or Order Prints",
        text: "Share a private digital link, download high-res files, or order physical cards and framed prints delivered to your door.",
        url: `${SITE_URL}/how-it-works#step-5`,
      },
    ],
  };
}

export function getFaqSchema(faqs: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };
}

export function getProductCatalogSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Dearly Studio Products & Prints",
    description:
      "Custom physical prints, folded cards, postcards, and framed wall art made from your photos.",
    itemListElement: [
      {
        "@type": "Product",
        position: 1,
        name: "Custom Postcard",
        description: "4 x 6 inch printed postcard on thick matte stock.",
        offers: {
          "@type": "Offer",
          price: "6.00",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
      },
      {
        "@type": "Product",
        position: 2,
        name: "Luxury Folded Greeting Card",
        description: "A6 folded card on premium paper stock with envelope.",
        offers: {
          "@type": "Offer",
          price: "8.00",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
      },
      {
        "@type": "Product",
        position: 3,
        name: "Archival Photo Print",
        description: "Archival photo print in sizes up to 12x16, matte or lustre.",
        offers: {
          "@type": "Offer",
          price: "12.00",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
      },
      {
        "@type": "Product",
        position: 4,
        name: "Solid Wood Framed Print",
        description: "Ready-to-hang print in a light oak or charcoal frame with shatterproof glass.",
        offers: {
          "@type": "Offer",
          price: "24.00",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
      },
      {
        "@type": "Product",
        position: 5,
        name: "Print-Ready Digital Download",
        description: "High-resolution 300 DPI PDF/JPG with bleed for self-printing.",
        offers: {
          "@type": "Offer",
          price: "10.00",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
      },
    ],
  };
}

export function getBreadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}
