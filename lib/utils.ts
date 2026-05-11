import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Mirror next.config.ts:basePath. The /CyBiasBench prefix is only used when
// the production build targets the GitHub Pages mirror; on Vercel (or any
// root-served host) NEXT_PUBLIC_DEPLOY_TARGET=vercel disables the prefix.
// Must use a NEXT_PUBLIC_* var so the value is inlined into the client bundle;
// process.env.VERCEL is only available server-side and would resolve to
// undefined in the browser, leaving the prefix on Vercel deployments.
const isVercel = process.env.NEXT_PUBLIC_DEPLOY_TARGET === "vercel";
export const BASE_PATH =
  process.env.NODE_ENV === "production" && !isVercel ? "/CyBiasBench" : "";
