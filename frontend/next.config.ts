import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      // Disable Webpack cache to fix "Array buffer allocation failed" on 32-bit Node
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
