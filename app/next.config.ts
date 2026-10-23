import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// The repo root has its own pnpm lockfile (scripts); pin the app as the workspace root.
const appRoot = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: appRoot,
  turbopack: { root: appRoot },
};

export default nextConfig;
