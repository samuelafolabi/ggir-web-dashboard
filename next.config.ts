import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  serverExternalPackages: ["@duckdb/duckdb-wasm"],
};

export default nextConfig;
