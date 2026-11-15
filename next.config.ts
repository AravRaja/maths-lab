import type { NextConfig } from "next";

// Static export: the whole lab deploys to Vercel free with no server.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // Milestone links in the "Yours to write" panels point at each project's LEARNING.md on GitHub.
  env: { NEXT_PUBLIC_REPO_URL: process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/AravRaja/maths-lab" },
};

export default nextConfig;
