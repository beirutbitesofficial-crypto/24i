import type { NextConfig } from "next";

// The marketing website (./website) is deployed as its own Next.js app with basePath "/website".
// Set WEBSITE_URL to that deployment's origin and this app serves it at /website (Next.js multi-zones).
const websiteUrl = process.env.WEBSITE_URL?.replace(/\/+$/, "");

const config: NextConfig = { poweredByHeader: false, experimental: { serverActions: { bodySizeLimit: "10mb" } }, headers: async () => [{ source: "/(.*)", headers: [{ key: "X-Content-Type-Options", value: "nosniff" },{ key: "X-Frame-Options", value: "DENY" },{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }] }], rewrites: async () => websiteUrl ? [{ source: "/website", destination: `${websiteUrl}/website` }, { source: "/website/:path*", destination: `${websiteUrl}/website/:path*` }] : [] };
export default config;
