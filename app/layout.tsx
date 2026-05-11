import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { SITE, RESEARCHERS, REPO, IS_ANONYMOUS, VENUE_VISIBLE } from "@/lib/config";
import { BASE_PATH } from "@/lib/utils";

const SITE_URL = SITE.url.replace(/\/$/, "");
// OG host is the actual deployment that serves the image. Anonymous submissions
// share the Vercel URL; the auto-generated cy-bias-bench.vercel.app subdomain
// carries no identifying info, so it is safe as a hard default.
const OG_HOST = (
  process.env.NEXT_PUBLIC_OG_HOST ?? "https://cy-bias-bench.vercel.app"
).replace(/\/$/, "");
const OG_IMAGE = `${OG_HOST}/og.png`;

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
    ...(VENUE_VISIBLE ? ["NeurIPS 2026", "datasets and benchmarks"] : []),
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
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "CyBiasBench: 630-session benchmark for attack-selection bias in LLM cyber-attack agents" }],
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
              // Light mode is the canonical default; only apply 'dark' when
              // the user has explicitly opted in via the navbar toggle.
              document.documentElement.className = t === 'dark' ? '' : 'light';
            } catch(e) {
              document.documentElement.className = 'light';
            }
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
