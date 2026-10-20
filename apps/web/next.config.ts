import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

import { getApiUrl } from "./src/shared/config/api-url";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
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
