function isKeylessFomoPath(path) {
  const normalized = path.replace(/^\//, "");

  // Trader PnL boards are free; token boards (trending, most-held, etc.) need FOMO_API_KEY.
  if (/^v2\/leaderboard\/(24h|7d|30d|all)(\?|$)/.test(normalized)) {
    return true;
  }

  return (
    normalized.startsWith("v2/alerts") ||
    normalized === "v1" ||
    normalized.startsWith("v1/") ||
    normalized === "health"
  );
}

async function proxyJson(targetUrl, headers = {}) {
  const upstream = await fetch(targetUrl, { headers });
  const body = await upstream.text();

  return new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
    },
  });
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const { pathname, search } = url;

  if (pathname.startsWith("/api/fomoapi/")) {
    const path = pathname.slice("/api/fomoapi/".length);
    const targetUrl = `https://api.fomoapi.io/${path}${search}`;
    const headers = {};

    if (process.env.FOMO_API_KEY && !isKeylessFomoPath(path)) {
      headers.Authorization = `Bearer ${process.env.FOMO_API_KEY}`;
    }

    try {
      return await proxyJson(targetUrl, headers);
    } catch (error) {
      return Response.json(
        { error: "Could not reach FOMO API", message: error.message },
        { status: 502 },
      );
    }
  }

  if (pathname.startsWith("/api/binance/")) {
    const path = pathname.slice("/api/binance/".length);
    const targetUrl = `https://api.binance.com/${path}${search}`;

    try {
      return await proxyJson(targetUrl);
    } catch (error) {
      return Response.json(
        { error: "Could not reach Binance API", message: error.message },
        { status: 502 },
      );
    }
  }

  if (pathname.startsWith("/api/fomo/")) {
    const path = pathname.slice("/api/fomo/".length);
    const targetUrl = `https://prod-api.fomo.family/${path}${search}`;
    const headers = {
      "app-language": "en",
      "x-supported-chains": "1,56,143,4663,8453,1399811149",
    };

    if (process.env.FOMO_TOKEN) {
      headers.Authorization = `Bearer ${process.env.FOMO_TOKEN}`;
    }

    try {
      return await proxyJson(targetUrl, headers);
    } catch (error) {
      return Response.json(
        { error: "Could not reach FOMO app API", message: error.message },
        { status: 502 },
      );
    }
  }

  if (pathname === "/api/current_coin") {
    return Response.json(null);
  }

  if (pathname.startsWith("/api/total_value_history")) {
    return Response.json([]);
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}

export const config = {
  matcher: ["/api/:path*"],
};
