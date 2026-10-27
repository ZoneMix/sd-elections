import type { NextConfig } from "next";

// Static export — the UI is a client-side live-poller served as Cloudflare
// Worker static assets (./out). The `/api/*` proxy lives in worker/index.ts.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
};

export default nextConfig;
