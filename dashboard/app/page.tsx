"use client";

import React, { useEffect, useState } from "react";
import { HeroSection } from "@/components/hero-section";
import { FadeIn } from "@/components/fade-in";
import { L2SelVsAsr } from "@/components/sections/layer2-decoupling";
import {
  ArticleChapters,
  ArticleEndMatter,
  ArticleIntro,
} from "@/components/article/article-body";
import type { PaperSummary } from "@/lib/types";
import { BASE_PATH } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export default function Home() {
  const t = useT();
  const [data, setData] = useState<PaperSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE_PATH}/data/paper_summary.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main className="min-h-screen">
      <FadeIn>
        <HeroSection />
      </FadeIn>

      {/* Lead figure: selection share vs attack success rate, radar / table toggle. */}
      <section id="overview" className="scroll-mt-20 pt-2">
        {error && (
          <div className="max-w-[800px] mx-auto px-4 sm:px-6 text-center py-16">
            <p className="text-destructive text-sm">
              {t("Failed to load data", "데이터를 불러오지 못함")}: {error}
            </p>
          </div>
        )}
        {!data && !error && (
          <div className="max-w-[800px] mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-72 rounded-lg border border-border bg-foreground/[0.04] animate-pulse" />
              ))}
            </div>
          </div>
        )}
        {data && (
          <FadeIn>
            <L2SelVsAsr data={data} />
          </FadeIn>
        )}
      </section>

      <ArticleIntro />

      {data ? (
        <div id="findings">
          <ArticleChapters data={data} />
        </div>
      ) : (
        !error && (
          <div className="max-w-[800px] mx-auto px-4 sm:px-6 pt-16">
            <div className="animate-pulse rounded-md bg-foreground/10 h-64" />
          </div>
        )
      )}

      <ArticleEndMatter />
    </main>
  );
}
