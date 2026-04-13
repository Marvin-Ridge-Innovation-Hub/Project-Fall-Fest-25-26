import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  // Asset prefix for proper path resolution in static exports
  assetPrefix: './',
  // Optional: Ensures links work correctly with standard file servers
  trailingSlash: true, };

export default nextConfig;
