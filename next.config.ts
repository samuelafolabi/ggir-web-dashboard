import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  turbopack: {},
  serverExternalPackages: ["@duckdb/duckdb-wasm"],
};

export default nextConfig;
