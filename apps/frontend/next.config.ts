import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker runtime image
  output: "standalone",
  // Let phones on the local Wi-Fi load the dev server (dev only)
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  images: {
    // Product photos come from many external seller/CDN domains (see seed data)
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    // Tailwind CSS is small: put it in a <style> tag instead of a render-blocking <link>
    inlineCss: true,
  },
  turbopack: {
    resolveAlias: {
      // Drop Next's legacy polyfills (Array.prototype.at, Object.hasOwn, ...)
      // app-globals.js requires it by this relative path
      "../build/polyfills/polyfill-module": "./lib/no-legacy-polyfills.js",
    },
  },
};

export default nextConfig;
