import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
    // Hostinger's build containers cap the number of threads. By default Next.js starts one
    // build worker per detected CPU and each loads Prisma's engine with its own thread pool,
    // which fails with "OS can't spawn worker thread (os error 11)". One worker is enough.
    cpus: 1,
    workerThreads: false,
  },
  headers: async () => [{ source: "/(.*)", headers: [{ key: "X-Content-Type-Options", value: "nosniff" },{ key: "X-Frame-Options", value: "DENY" },{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }] }],
};

export default config;
