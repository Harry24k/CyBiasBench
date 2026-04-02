import type { NextConfig } from "next";
import { resolve } from "path";

const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.NODE_ENV === "production" ? "/CyBiasBench" : "",
  images: { unoptimized: true },
  turbopack: { root: resolve(".") },
};

export default nextConfig;
