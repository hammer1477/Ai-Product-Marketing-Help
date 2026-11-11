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
  // @resvg/resvg-js and sharp both ship native .node addons; they must be
  // required at runtime rather than bundled, or Turbopack fails trying to
  // place them in an ESM chunk.
  serverExternalPackages: ["@resvg/resvg-js", "sharp"],
  // The poster renderer reads its font files from public/fonts with fs at
  // runtime (Satori needs the raw buffers). On Vercel, public/ is served
  // from the CDN and is NOT inside serverless functions unless traced in,
  // so without this every generation and export would fail on missing fonts.
  outputFileTracingIncludes: {
    "/api/**/*": ["./public/fonts/**/*"],
  },
  // Server Actions default to a 1MB body limit, far too small for a real
  // product photo upload (ProductUploadForm posts the file directly via a
  // Server Action, not a separate API route).
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
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
