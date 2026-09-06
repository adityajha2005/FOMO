export const config = { runtime: "edge" };

function isKeylessPath(path) {
  const normalized = path.replace(/^\/+/, "");
  return (
    normalized.startsWith("v2/leaderboard/") ||
    normalized.startsWith("v2/alerts") ||
    normalized === "v1" ||
    normalized.startsWith("v1/") ||
    normalized === "health"
  );
}

export default async function handler(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/fomoapi\/?/, "");
  const targetUrl = `https://api.fomoapi.io/${path}${url.search}`;

  const headers = new Headers();
  const useKey = process.env.FOMO_API_KEY && !isKeylessPath(path);

  if (useKey) {
    headers.set("Authorization", `Bearer ${process.env.FOMO_API_KEY}`);
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
      { error: "Could not reach FOMO API", message: error.message },
      { status: 502 },
    );
  }
}
