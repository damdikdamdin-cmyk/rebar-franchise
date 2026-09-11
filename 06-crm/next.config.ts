import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // На VPS ~1GB typecheck в next build часто OOM — локально/CI проверяем tsc отдельно.
  typescript: {
    ignoreBuildErrors: process.env.SKIP_TS_CHECK === "1",
  },
};

export default nextConfig;
