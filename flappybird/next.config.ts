import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // Optional: Ensures links work correctly with standard file servers
  assetPrefix: './',
  images: {
    unoptimized: true,
  }, };

export default nextConfig;
