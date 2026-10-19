import type { PaperSummary } from "./types";
import { BASE_PATH } from "./utils";

let cached: PaperSummary | null = null;

export async function loadPaperSummary(): Promise<PaperSummary> {
  if (cached) return cached;
  const res = await fetch(`${BASE_PATH}/data/paper_summary.json`);
  if (!res.ok) {
    throw new Error(`Failed to load paper summary: ${res.status} ${res.statusText}`);
  }
  cached = await res.json();
  return cached!;
}
