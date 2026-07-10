import type { NextConfig } from "next";

/**
 * Prefer a Vercel region close to the primary Neon database.
 * Override via project settings if your Neon primary is elsewhere.
 * Default: iad1 (US East) — common Neon default.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "*.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
