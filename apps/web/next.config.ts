import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

import { getApiUrl } from "./src/shared/config/api-url";
import { securityHeaders } from "./src/shared/config/security-headers";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(process.env.NODE_ENV !== "production"),
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${getApiUrl()}/:path*`,
      },
    ];
  },
};

export default nextConfig;
