import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Cache Components (PPR-style static/dynamic composition) is aimed at
  // apps with a static shell around islands of per-request data. This app
  // is an authenticated dashboard — nearly every page needs the user's
  // session via cookies(), so there's no static shell to benefit from, only
  // the overhead of a Suspense boundary around literally everything.
  // Standard per-request dynamic rendering (the default without this flag)
  // is the right fit here.
  // @resvg/resvg-js ships a native .node addon; it must be required at
  // runtime rather than bundled, or Turbopack fails trying to place it in
  // an ESM chunk.
  serverExternalPackages: ["@resvg/resvg-js"],
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
