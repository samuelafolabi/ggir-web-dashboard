import type { NextConfig } from "next";

const debugRunId = `next-config-${Date.now()}`;
// #region agent log
fetch("http://127.0.0.1:7670/ingest/c9f36c3f-cd4e-427a-85df-a3756ceef07b", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9e7997" },
  body: JSON.stringify({
    sessionId: "9e7997",
    runId: debugRunId,
    hypothesisId: "H2",
    location: "next.config.ts:3",
    message: "next.config.ts loaded during build",
    data: {
      nodeEnv: process.env.NODE_ENV ?? null,
      ci: process.env.CI ?? null,
      githubActions: process.env.GITHUB_ACTIONS ?? null,
    },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  turbopack: {},
  serverExternalPackages: ["@duckdb/duckdb-wasm"],
  images: {
    unoptimized: true,
  },
};

// #region agent log
fetch("http://127.0.0.1:7670/ingest/c9f36c3f-cd4e-427a-85df-a3756ceef07b", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9e7997" },
  body: JSON.stringify({
    sessionId: "9e7997",
    runId: debugRunId,
    hypothesisId: "H3",
    location: "next.config.ts:26",
    message: "next.config.ts export settings",
    data: {
      output: nextConfig.output ?? null,
      hasImagesConfig: Boolean(nextConfig.images),
      imageUnoptimized:
        typeof nextConfig.images === "object" && nextConfig.images !== null
          ? Boolean((nextConfig.images as { unoptimized?: boolean }).unoptimized)
          : null,
    },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

export default nextConfig;
