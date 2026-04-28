import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SITE, RESEARCHERS, REPO, IS_ANONYMOUS } from "@/lib/config";
import { BASE_PATH } from "@/lib/utils";

const SITE_URL = SITE.url.replace(/\/$/, "");
const OG_IMAGE = `${SITE_URL}${BASE_PATH}/images/overview.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE.fullTitle,
  description: SITE.shortDescription,
  keywords: [
    "LLM agents",
    "cybersecurity benchmark",
    "attack-selection bias",
    "web exploitation",
    "agent evaluation",
    "NeurIPS 2026",
    "datasets and benchmarks",
  ],
  authors: IS_ANONYMOUS
    ? [{ name: "Anonymous Authors" }]
    : RESEARCHERS.map((r) => ({ name: r.name })),
  openGraph: {
    type: "article",
    title: SITE.name,
    description: SITE.shortDescription,
    url: `${SITE_URL}${BASE_PATH}`,
    siteName: SITE.name,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "CyBiasBench overview" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.name,
    description: SITE.shortDescription,
    images: [OG_IMAGE],
  },
  robots: { index: !IS_ANONYMOUS, follow: !IS_ANONYMOUS },
};

function StructuredData() {
  const authorList = IS_ANONYMOUS
    ? [{ "@type": "Person", name: "Anonymous Authors" }]
    : RESEARCHERS.map((r) => ({
        "@type": "Person",
        name: r.name,
        affiliation: { "@type": "Organization", name: r.affiliation },
      }));

  const scholarlyArticle = {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    name: SITE.fullTitle,
    headline: SITE.fullTitle,
    description: SITE.longDescription,
    abstract: SITE.longDescription,
    author: authorList,
    datePublished: `${SITE.year}`,
    inLanguage: "en",
    license: "https://creativecommons.org/licenses/by/4.0/",
    isAccessibleForFree: true,
    image: OG_IMAGE,
    url: `${SITE_URL}${BASE_PATH}`,
  };

  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: SITE.name,
    description: SITE.longDescription,
    keywords: ["LLM agents", "cybersecurity", "attack-selection bias", "web exploitation"],
    creator: authorList,
    license: "https://creativecommons.org/licenses/by/4.0/",
    isAccessibleForFree: true,
    url: `${SITE_URL}${BASE_PATH}`,
    version: `${SITE.year}.04`,
    measurementTechnique: [
      "Attack-family classification of HTTP requests via OWASP CRS + CAPEC/CWE/WSTG patterns",
      "Per-session entropy H(X), selection rate Selᵢ, attack success rate ASR/ASRᵢ",
      "Cross-condition Jensen–Shannon divergence",
    ],
    variableMeasured: [
      "Technique entropy H(X)",
      "Selection rate Selᵢ",
      "Attack Success Rate (ASR / ASRᵢ)",
      "Tokens per Success (TPS)",
      "Compliance",
      "ΔASR",
    ],
    ...(REPO.url ? { codeRepository: REPO.url } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(scholarlyArticle) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dataset) }}
      />
    </>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var t = localStorage.getItem('cybiasbench-theme');
              document.documentElement.className = t === 'light' ? 'light' : '';
            } catch(e) {}
          })();
        `}} />
        <StructuredData />
      </head>
      <body className="antialiased min-h-screen bg-background text-foreground flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
