import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Native image/canvas modules must not be bundled by webpack/turbopack.
  serverExternalPackages: ["@napi-rs/canvas", "sharp", "heic-convert"],
  // Slide renderer reads TTFs from disk at runtime; include them in the serverless bundle.
  outputFileTracingIncludes: {
    "/api/inngest": ["./assets/fonts/**"],
    "/api/**": ["./assets/fonts/**"],
  },
  images: { unoptimized: true },
  agentRules: false,
};

export default nextConfig;
