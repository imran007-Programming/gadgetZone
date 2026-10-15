import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker runtime image
  output: "standalone",
  images: {
    // Product photos are served from Cloudinary (see apps/backend/src/cloudinary)
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

export default nextConfig;
