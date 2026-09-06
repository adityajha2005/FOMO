export default async function handler(req, res) {
  const segments = req.query.path;
  const path = Array.isArray(segments) ? segments.join("/") : segments || "";

  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  requestUrl.searchParams.delete("path");
  const search = requestUrl.search;

  const targetUrl = `https://prod-api.fomo.family/${path}${search}`;
  const headers = {
    "app-language": "en",
    "x-supported-chains": "1,56,143,4663,8453,1399811149",
  };

  if (process.env.FOMO_TOKEN) {
    headers.Authorization = `Bearer ${process.env.FOMO_TOKEN}`;
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
    });

    const body = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json";

    res.status(upstream.status).setHeader("Content-Type", contentType).send(body);
  } catch (error) {
    res.status(502).json({ error: "Could not reach FOMO app API", message: error.message });
  }
}
