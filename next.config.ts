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
    // The Master console's owner-only posters (app/api/admin/poster).
    "/api/admin/poster/*": ["./private/posters/**/*"],
  },
  // Server Actions default to a 1MB body limit, far too small for a real
  // product photo upload (ProductUploadForm posts the file directly via a
  // Server Action, not a separate API route).
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Product Background Remover only: cross-origin isolation lets the in-browser
  // model use multi-threaded WebAssembly (~3× faster on a laptop CPU).
  // "credentialless" keeps cross-origin loads (model CDN, images) working
  // without them having to send CORP headers. No other route is affected.
  headers() {
    return [
      {
        source: "/background-remover",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
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
