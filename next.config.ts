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
  experimental: {
    // Turbopack transform for SVG: treat as React components
    // See: https://nextjs.org/docs/app/api-reference/next-config-js/turbopack
    turbo: {
      rules: {
        // Use built-in svgr-like loader in turbopack via emotion/compat if required; otherwise leave empty
      }
    }
  }
};

export default nextConfig;
