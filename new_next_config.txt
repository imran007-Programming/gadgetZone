import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker runtime image
  output: "standalone",
  images: {
    // Product photos come from many external seller/CDN domains (see seed data)
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
