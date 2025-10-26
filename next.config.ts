import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Enable Turbopack explicitly and provide empty config to silence mismatch
  turbopack: {},
  // Migrate SVG handling to Turbopack rules when available; keep webpack as fallback
  webpack(config) {
    // Handle SVG imports as React components using SVGR (webpack build fallback)
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack']
    });
    return config;
  },
  // Remove invalid experimental key; Turbopack configured via top-level `turbopack` above
};

export default nextConfig;
