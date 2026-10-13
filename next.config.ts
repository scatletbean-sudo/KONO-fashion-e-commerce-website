import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.KONO_MEDIA_DEV_RUNTIME === "1" ? { distDir: ".next-media-dev" } : {}),
};

export default nextConfig;
