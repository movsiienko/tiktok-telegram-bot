import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow yt-dlp-wrap to use child_process
  serverExternalPackages: ["yt-dlp-wrap"],
};

export default nextConfig;
