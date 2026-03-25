import type { AnalysisResults } from "./types";

let cachedData: AnalysisResults | null = null;

export async function loadAnalysisData(): Promise<AnalysisResults> {
  if (cachedData) return cachedData;
  const basePath = process.env.NODE_ENV === "production" ? "/CyBiasBench" : "";
  const res = await fetch(`${basePath}/data/analysis_results.json`);
  if (!res.ok) {
    throw new Error(`Failed to load analysis data: ${res.status} ${res.statusText}`);
  }
  cachedData = await res.json();
  return cachedData!;
}
