"use client";

import { FadeIn } from "@/components/fade-in";
import { LeaderboardTable } from "@/components/leaderboard-table";
import type { PaperSummary } from "@/lib/types";

export function OverviewSection({ data }: { data: PaperSummary }) {
  return (
    <FadeIn>
      <LeaderboardTable data={data} />
    </FadeIn>
  );
}
