import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Bumps the service worker's cache name on every build so stale assets are evicted.
const APP_VERSION = process.env.APP_VERSION ?? new Date().toISOString().replace(/\D/g, "").slice(0, 12);

/**
 * Content-Security-Policy for production. All content is first-party and bundled, so nothing
 * external is allowed. Next.js streams its RSC payload in inline <script> tags, and without
 * per-request nonces (which would stop every page being prerendered and cached offline) that
 * needs 'unsafe-inline'. XSS is prevented at the source instead: content is rendered only as
 * text, and workflow.js blocks HTML sinks.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Keeps soft navigations pending while offline and powers the useOffline() indicator.
    useOffline: true,
  },
  env: { NEXT_PUBLIC_APP_VERSION: APP_VERSION },
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          ...(isProd ? [{ key: "Content-Security-Policy", value: csp }] : []),
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
