import type { NextConfig } from "next";

// Served at 24iproduction.com/website through the main app's rewrites (Next.js multi-zones).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/website";

const config: NextConfig = {
  basePath,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    },
  ],
  // Visiting the bare deployment URL lands on the site.
  redirects: async () => (basePath ? [{ source: "/", destination: basePath, basePath: false, permanent: false }] : []),
};

export default config;
