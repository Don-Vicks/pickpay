import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// The repo root has its own pnpm lockfile (scripts); pin the app as the workspace root.
const appRoot = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: appRoot,
  // No floating dev badge (it shows up in demo screenshots).
  devIndicators: false,
  turbopack: { root: appRoot },
};

export default nextConfig;
