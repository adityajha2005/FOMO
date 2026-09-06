export default async function handler(req, res) {
  const segments = req.query.path;
  const path = Array.isArray(segments) ? segments.join("/") : segments || "";

  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  requestUrl.searchParams.delete("path");
  const search = requestUrl.search;

  const targetUrl = `https://api.binance.com/${path}${search}`;

  try {
    const upstream = await fetch(targetUrl, { method: req.method });
    const body = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json";

    res.status(upstream.status).setHeader("Content-Type", contentType).send(body);
  } catch (error) {
    res.status(502).json({ error: "Could not reach Binance API", message: error.message });
  }
}
