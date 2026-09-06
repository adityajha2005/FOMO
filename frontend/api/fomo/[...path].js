export const config = { runtime: "edge" };

export default async function handler(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/fomo\/?/, "");
  const targetUrl = `https://prod-api.fomo.family/${path}${url.search}`;

  const headers = new Headers({
    "app-language": "en",
    "x-supported-chains": "1,56,143,4663,8453,1399811149",
  });

  if (process.env.FOMO_TOKEN) {
    headers.set("Authorization", `Bearer ${process.env.FOMO_TOKEN}`);
  }

  try {
    const upstream = await fetch(targetUrl, { method: request.method, headers });
    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    return Response.json(
      { error: "Could not reach FOMO app API", message: error.message },
      { status: 502 },
    );
  }
}
