import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.BASE_PATH ?? "",
  reactStrictMode: true,
  turbopack: {},
  serverExternalPackages: ["@duckdb/duckdb-wasm"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

