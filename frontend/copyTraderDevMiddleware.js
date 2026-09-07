import http from "node:http";
import { copyTraderDevStub } from "./devCopyTraderStub.js";

const API_HOST = "127.0.0.1";
const API_PORT = 5123;
let warned = false;

function proxyToBackend(req, res) {
  return new Promise((resolve, reject) => {
    const upstream = http.request(
      {
        hostname: API_HOST,
        port: API_PORT,
        method: req.method,
        path: req.url,
        headers: {
          ...req.headers,
          host: `${API_HOST}:${API_PORT}`,
        },
      },
      (proxyRes) => {
        res.statusCode = proxyRes.statusCode || 502;
        for (const [key, value] of Object.entries(proxyRes.headers)) {
          if (value !== undefined) {
            res.setHeader(key, value);
          }
        }
        proxyRes.pipe(res);
        proxyRes.on("end", resolve);
      },
    );

    upstream.on("error", reject);

    if (req.method === "GET" || req.method === "HEAD") {
      upstream.end();
      return;
    }

    req.pipe(upstream);
  });
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function warnOnce() {
  if (warned) {
    return;
  }
  warned = true;
  console.warn(
    "[copy-trader] Flask API is not running on :5123 — serving a paper stub.\n" +
      "  Start it with: python binance_trade_bot/api_server.py",
  );
}

export function copyTraderDevMiddleware() {
  return async (req, res, next) => {
    const url = req.url || "";
    if (!url.startsWith("/api/copy-trader")) {
      next();
      return;
    }

    if (req.method === "GET" && url.startsWith("/api/copy-trader")) {
      try {
        await proxyToBackend(req, res);
        return;
      } catch {
        warnOnce();
        sendJson(res, 200, copyTraderDevStub());
        return;
      }
    }

    if (req.method === "POST") {
      try {
        await proxyToBackend(req, res);
        return;
      } catch {
        warnOnce();
        sendJson(res, 503, {
          ok: false,
          error: "Copy-trader API offline. Start: python binance_trade_bot/api_server.py",
        });
        return;
      }
    }

    next();
  };
}
