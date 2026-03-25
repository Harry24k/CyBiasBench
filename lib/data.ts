import type { AnalysisResults } from "./types";
import { BASE_PATH } from "./utils";

let cachedData: AnalysisResults | null = null;

export async function loadAnalysisData(): Promise<AnalysisResults> {
  if (cachedData) return cachedData;
  const res = await fetch(`${BASE_PATH}/data/analysis_results.json`);
  if (!res.ok) {
    throw new Error(`Failed to load analysis data: ${res.status} ${res.statusText}`);
  }
  cachedData = await res.json();
  return cachedData!;
}
