import type { NextConfig } from "next";

import { getApiUrl } from "./src/shared/config/api-url";

const nextConfig: NextConfig = {
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
