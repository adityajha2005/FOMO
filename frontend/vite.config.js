import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { getFomoBearer, invalidateFomoBearer } from "./fomoAuth.js";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  let fomoBearer = "";

  async function syncFomoBearer(force = false) {
    fomoBearer = await getFomoBearer(env, { force });
    return fomoBearer;
  }

  return {
    plugins: [
      react(),
      {
        name: "fomo-auth",
        configureServer() {
          syncFomoBearer().then((token) => {
            if (token) {
              console.log("[fomo-auth] bearer ready for prod-api.fomo.family proxy");
            } else if (env.FOMO_REFRESH_TOKEN || env.FOMO_TOKEN) {
              console.warn("[fomo-auth] no valid FOMO bearer — clan leaderboard will fall back to estimates");
            }
          });

          setInterval(() => {
            syncFomoBearer().catch(() => {});
          }, 30 * 60 * 1000);
        },
      },
    ],
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
              const normalized = upstreamPath.replace(/^\//, "");
              const keyless =
                /^v2\/leaderboard\/(24h|7d|30d|all)(\?|$)/.test(normalized) ||
                normalized.startsWith("v2/alerts") ||
                normalized === "v1" ||
                normalized.startsWith("v1/") ||
                normalized === "health";

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
              if (fomoBearer) {
                proxyReq.setHeader("Authorization", `Bearer ${fomoBearer}`);
              }

              proxyReq.setHeader("app-language", "en");
              proxyReq.setHeader("x-supported-chains", "1,56,143,4663,8453,1399811149");
            });

            proxy.on("proxyRes", (proxyRes, req, res) => {
              if (proxyRes.statusCode !== 401 && proxyRes.statusCode !== 430) {
                return;
              }

              if (!env.FOMO_REFRESH_TOKEN) {
                return;
              }

              invalidateFomoBearer();
              syncFomoBearer(true).catch(() => {});
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
