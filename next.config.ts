import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Enable Turbopack explicitly and provide empty config to silence mismatch
  turbopack: {},
  // Relax build-time checks on Vercel/Next build
  typescript: {
    // Allow production builds to complete even if there are type errors
    ignoreBuildErrors: true,
  },
  // Configure body size limit for large file uploads (affects Server Actions and may affect Route Handlers)
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb', // Match our 500MB file upload limit
    },
  },
  // Migrate SVG handling to Turbopack rules when available; keep webpack as fallback
  webpack(config) {
    // Handle SVG imports as React components using SVGR (webpack build fallback)
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack']
    });
    return config;
  },
  // Turbopack configured via top-level `turbopack` above
};

export default nextConfig;
