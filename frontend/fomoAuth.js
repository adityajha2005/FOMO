const PRIVY_APP_ID = "cm6h485o300n3zj9yl6vpedq7";
const PRIVY_AUTH_API = "https://auth.privy.io";

const cached = { bearer: "", expMs: 0 };

function jwtPayload(token) {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  } catch {
    return {};
  }
}

function jwtExpMs(token) {
  const exp = jwtPayload(token).exp;
  return typeof exp === "number" ? exp * 1000 : 0;
}

async function refreshPrivy(refreshToken, bearer = "") {
  const headers = {
    "Content-Type": "application/json",
    "privy-app-id": PRIVY_APP_ID,
    "privy-client": "react-auth:2.5.0",
    Origin: "https://fomo.family",
    Referer: "https://fomo.family/",
  };
  const body = JSON.stringify({ refresh_token: refreshToken });

  let response = await fetch(`${PRIVY_AUTH_API}/api/v1/sessions`, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok && bearer) {
    const did = jwtPayload(bearer).sub;
    if (did) {
      response = await fetch(`${PRIVY_AUTH_API}/api/v1/users/${encodeURIComponent(did)}/sessions`, {
        method: "POST",
        headers,
        body,
      });
    }
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Privy refresh failed (${response.status}): ${text.slice(0, 120)}`);
  }

  const data = await response.json();
  const token = String(data.token || "").trim();
  if (!token) {
    throw new Error("Privy refresh returned no access token");
  }

  return token;
}

export async function getFomoBearer(env, { force = false } = {}) {
  const now = Date.now();

  if (!force && cached.bearer && cached.expMs > now + 5 * 60_000) {
    return cached.bearer;
  }

  const refreshToken = (env.FOMO_REFRESH_TOKEN || "").trim();
  const staticToken = (env.FOMO_TOKEN || "").trim();

  if (refreshToken) {
    try {
      const bearer = await refreshPrivy(refreshToken, cached.bearer || staticToken);
      cached.bearer = bearer;
      cached.expMs = jwtExpMs(bearer);
      return bearer;
    } catch (error) {
      console.warn("[fomo-auth]", error.message);
    }
  }

  if (staticToken && jwtExpMs(staticToken) > now + 60_000) {
    cached.bearer = staticToken;
    cached.expMs = jwtExpMs(staticToken);
    return staticToken;
  }

  return cached.bearer || staticToken || "";
}

export function invalidateFomoBearer() {
  cached.expMs = 0;
}
