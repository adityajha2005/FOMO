export const config = { runtime: "edge" };

export default async function handler(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/binance\/?/, "");
  const targetUrl = `https://api.binance.com/${path}${url.search}`;

  try {
    const upstream = await fetch(targetUrl, { method: request.method });
    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    return Response.json(
      { error: "Could not reach Binance API", message: error.message },
      { status: 502 },
    );
  }
}
