import type { NextConfig } from "next";

// Static export: every lab project deploys to Vercel free with no server.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
