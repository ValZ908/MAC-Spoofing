import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  serverExternalPackages: ["better-sqlite3"],
  devIndicators: false,
};

export default nextConfig;