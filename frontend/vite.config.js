import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api/fomoapi": {
          target: "https://api.fomoapi.io",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/fomoapi/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              const upstreamPath = proxyReq.path.replace(/^\/api\/fomoapi\/?/, "");
              const keyless =
                upstreamPath.startsWith("/v2/leaderboard/") ||
                upstreamPath.startsWith("/v2/alerts") ||
                upstreamPath === "/v1" ||
                upstreamPath.startsWith("/v1/") ||
                upstreamPath === "/health";

              if (env.FOMO_API_KEY && !keyless) {
                proxyReq.setHeader("Authorization", `Bearer ${env.FOMO_API_KEY}`);
              }
            });
          },
        },
        "/api/fomo": {
          target: "https://prod-api.fomo.family",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/fomo/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (env.FOMO_TOKEN) {
                proxyReq.setHeader("Authorization", `Bearer ${env.FOMO_TOKEN}`);
              }

              proxyReq.setHeader("app-language", "en");
              proxyReq.setHeader("x-supported-chains", "1,56,143,4663,8453,1399811149");
            });
          },
        },
        "/api": {
          target: "http://localhost:5123",
          changeOrigin: true,
        },
      },
    },
  };
});
