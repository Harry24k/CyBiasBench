import type { NextConfig } from "next";
import { resolve } from "path";

// basePath is only used for the GitHub Pages mirror at /CyBiasBench/.
// On Vercel (or any other root-served host) we deploy with VERCEL=1 set so
// the bundle ships without a path prefix and assets resolve at "/".
const isVercel =
  process.env.VERCEL === "1" ||
  process.env.DEPLOY_TARGET === "vercel" ||
  process.env.NEXT_PUBLIC_DEPLOY_TARGET === "vercel";

const nextConfig: NextConfig = {
  output: "export",
  basePath:
    process.env.NODE_ENV === "production" && !isVercel ? "/CyBiasBench" : "",
  images: { unoptimized: true },
  productionBrowserSourceMaps: false,
  turbopack: { root: resolve(".") },
};

export default nextConfig;
