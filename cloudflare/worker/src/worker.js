const DEFAULT_SITE_DATA = {
  news: [],
  live: { ticketLink: "", upcoming: [], past: [] },
  discography: { digital: [], demo: [] },
  profile: { image: "", text: "", links: [] },
};

function nowIso() {
  return new Date().toISOString();
}

function percentEncode(value) {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (ch) => "%" + ch.charCodeAt(0).toString(16).toUpperCase());
}

function normalizeSiteData(input) {
  const base = structuredClone(DEFAULT_SITE_DATA);
  if (!input || typeof input !== "object") return base;
  const data = { ...base, ...input };
  data.news = Array.isArray(data.news) ? data.news : [];
  data.live = data.live && typeof data.live === "object" ? data.live : base.live;
  data.live.ticketLink = data.live.ticketLink || "";
  data.live.upcoming = Array.isArray(data.live.upcoming) ? data.live.upcoming : [];
  data.live.past = Array.isArray(data.live.past) ? data.live.past : [];
  data.discography = data.discography && typeof data.discography === "object" ? data.discography : base.discography;
  data.discography.digital = Array.isArray(data.discography.digital) ? data.discography.digital : [];
  data.discography.demo = Array.isArray(data.discography.demo) ? data.discography.demo : [];
  data.profile = data.profile && typeof data.profile === "object" ? data.profile : base.profile;
  data.profile.image = data.profile.image || "";
  data.profile.text = data.profile.text || "";
  data.profile.links = Array.isArray(data.profile.links) ? data.profile.links : [];
  return data;
}

function getAllowedOrigins(env) {
  const raw = env.ALLOWED_ORIGINS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function createCorsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = getAllowedOrigins(env);
  const allowOrigin = allowedOrigins.length === 0
    ? "*"
    : allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Admin-Token",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(body, request, env, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...createCorsHeaders(request, env),
    },
  });
}

function isAdminAuthorized(request, env) {
  const bypass = String(env.BYPASS_ADMIN_TOKEN || "false").toLowerCase() === "true";
  if (bypass) return true;
  // Prefer secret binding to avoid committing tokens to git; keep ADMIN_TOKEN for backward compatibility.
  const expected = env.ADMIN_SHARED_TOKEN || env.ADMIN_TOKEN || "";
  if (!expected) return false;
  const auth = request.headers.get("Authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const token = bearer || request.headers.get("X-Admin-Token") || "";
  return token === expected;
}

async function getSiteData(env) {
  const row = await env.DB.prepare("SELECT data FROM site_data WHERE id = 1").first();
  if (!row || !row.data) {
    const fallback = normalizeSiteData(DEFAULT_SITE_DATA);
    await env.DB.prepare(
      "INSERT OR REPLACE INTO site_data (id, data, updated_at) VALUES (1, ?, ?)"
    ).bind(JSON.stringify(fallback), nowIso()).run();
    return fallback;
  }
  try {
    return normalizeSiteData(JSON.parse(row.data));
  } catch (_error) {
    return normalizeSiteData(DEFAULT_SITE_DATA);
  }
}

async function saveSiteData(env, data) {
  const normalized = normalizeSiteData(data);
  await env.DB.prepare(
    "INSERT OR REPLACE INTO site_data (id, data, updated_at) VALUES (1, ?, ?)"
  ).bind(JSON.stringify(normalized), nowIso()).run();
  return normalized;
}

function findLiveById(siteData, liveId) {
  const upcoming = siteData.live.upcoming || [];
  const past = siteData.live.past || [];
  return [...upcoming, ...past].find((item) => item.id === liveId) || null;
}

function buildTweetText(live, env) {
  const rawDescription = (live.description || "").replace(/<br\s*\/?>/gi, "\n");
  const compactDescription = rawDescription.split("\n").map((line) => line.trim()).filter(Boolean).join(" / ");
  const hashtags = (env.X_DEFAULT_HASHTAGS || "").trim();

  const lines = [
    "【Live Info】",
    `${live.date || "日付未設定"} ${live.venue || ""}`.trim(),
    compactDescription,
    live.link || "",
    hashtags,
  ].filter(Boolean);

  let text = lines.join("\n");
  if (text.length <= 280) return text;

  const keep = lines.slice();
  keep[2] = compactDescription.slice(0, 80) + "…";
  text = keep.filter(Boolean).join("\n");
  if (text.length <= 280) return text;

  if (hashtags) {
    text = `【Live Info】\n${live.date || ""} ${live.venue || ""}\n${hashtags}`.trim();
  } else {
    text = `【Live Info】\n${live.date || ""} ${live.venue || ""}`.trim();
  }
  return text.slice(0, 280);
}

function makeNonce(length = 16) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("");
}

function bytesToBase64(bytes) {
  let binary = "";
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.byteLength; i += 1) {
    binary += String.fromCharCode(view[i]);
  }
  return btoa(binary);
}

async function hmacSha1Base64(key, message) {
  const keyBytes = new TextEncoder().encode(key);
  const msgBytes = new TextEncoder().encode(message);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgBytes);
  return bytesToBase64(signature);
}

function buildOAuthHeader(params) {
  const ordered = Object.keys(params).sort();
  const parts = ordered.map((key) => `${percentEncode(key)}="${percentEncode(params[key])}"`);
  return `OAuth ${parts.join(", ")}`;
}

async function buildOAuthHeaderForX({
  method,
  url,
  consumerKey,
  consumerSecret,
  accessToken,
  accessTokenSecret,
  extraParams = {},
}) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: makeNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const signatureParams = { ...oauthParams, ...extraParams };
  const parameterString = Object.keys(signatureParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(signatureParams[key])}`)
    .join("&");
  const signatureBase = `${method}&${percentEncode(url)}&${percentEncode(parameterString)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(accessTokenSecret)}`;
  const oauthSignature = await hmacSha1Base64(signingKey, signatureBase);

  return buildOAuthHeader({
    ...oauthParams,
    oauth_signature: oauthSignature,
  });
}

function getXCredentials(env) {
  const consumerKey = env.X_CONSUMER_KEY || "";
  const consumerSecret = env.X_CONSUMER_SECRET || "";
  const accessToken = env.X_ACCESS_TOKEN || "";
  const accessTokenSecret = env.X_ACCESS_TOKEN_SECRET || "";
  return { consumerKey, consumerSecret, accessToken, accessTokenSecret };
}

async function postTweetToX(env, text) {
  const { consumerKey, consumerSecret, accessToken, accessTokenSecret } = getXCredentials(env);

  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    throw new Error("X API認証情報が不足しています");
  }

  const method = "POST";
  const url = "https://api.x.com/2/tweets";
  const authHeader = await buildOAuthHeaderForX({
    method,
    url,
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret,
  });

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = payload?.detail || payload?.title || payload?.error || "unknown";
    throw new Error(`X投稿失敗: ${details}`);
  }

  const tweetId = payload?.data?.id;
  return {
    tweetId,
    url: tweetId ? `https://x.com/i/web/status/${tweetId}` : "",
    raw: payload,
  };
}

async function verifyXCredentials(env) {
  const { consumerKey, consumerSecret, accessToken, accessTokenSecret } = getXCredentials(env);
  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    throw new Error("X API認証情報が不足しています");
  }

  const method = "GET";
  const url = "https://api.x.com/1.1/account/verify_credentials.json";
  const extraParams = { include_entities: "false", skip_status: "true" };
  const authHeader = await buildOAuthHeaderForX({
    method,
    url,
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret,
    extraParams,
  });

  const query = new URLSearchParams(extraParams);
  const response = await fetch(`${url}?${query.toString()}`, {
    method,
    headers: { Authorization: authHeader },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details =
      payload?.errors?.[0]?.message || payload?.detail || payload?.title || payload?.error || "unknown";
    throw new Error(`X連携確認失敗: ${details}`);
  }

  return {
    id: payload?.id_str || String(payload?.id || ""),
    screenName: payload?.screen_name || "",
    name: payload?.name || "",
  };
}

async function recordPostLog(env, log) {
  await env.DB.prepare(
    `INSERT INTO x_posts (live_id, status, tweet_id, tweet_url, tweet_text, error_message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    log.liveId || "",
    log.status || "unknown",
    log.tweetId || "",
    log.tweetUrl || "",
    log.tweetText || "",
    log.errorMessage || "",
    nowIso()
  ).run();
}

async function handleRequest(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: createCorsHeaders(request, env),
    });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/public/site-data" && request.method === "GET") {
    const data = await getSiteData(env);
    return jsonResponse({ data }, request, env);
  }

  if (path === "/api/admin/site-data" && request.method === "GET") {
    if (!isAdminAuthorized(request, env)) {
      return jsonResponse({ error: "unauthorized" }, request, env, 401);
    }
    const data = await getSiteData(env);
    return jsonResponse({ data }, request, env);
  }

  if (path === "/api/admin/site-data" && request.method === "PUT") {
    if (!isAdminAuthorized(request, env)) {
      return jsonResponse({ error: "unauthorized" }, request, env, 401);
    }
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return jsonResponse({ error: "invalid payload" }, request, env, 400);
    }
    const saved = await saveSiteData(env, payload.data ?? payload);
    return jsonResponse({ ok: true, data: saved }, request, env);
  }

  if (path === "/api/admin/x-posts" && request.method === "GET") {
    if (!isAdminAuthorized(request, env)) {
      return jsonResponse({ error: "unauthorized" }, request, env, 401);
    }
    const liveId = url.searchParams.get("liveId");
    const stmt = liveId
      ? env.DB.prepare(
          `SELECT live_id as liveId, status, tweet_id as tweetId, tweet_url as tweetUrl, tweet_text as tweetText, error_message as errorMessage, created_at as createdAt
           FROM x_posts WHERE live_id = ? ORDER BY created_at DESC LIMIT 50`
        ).bind(liveId)
      : env.DB.prepare(
          `SELECT live_id as liveId, status, tweet_id as tweetId, tweet_url as tweetUrl, tweet_text as tweetText, error_message as errorMessage, created_at as createdAt
           FROM x_posts ORDER BY created_at DESC LIMIT 100`
        );
    const result = await stmt.all();
    return jsonResponse({ posts: result.results || [] }, request, env);
  }

  const livePostMatch = path.match(/^\/api\/admin\/live\/([^/]+)\/post-x$/);
  if (livePostMatch && request.method === "POST") {
    if (!isAdminAuthorized(request, env)) {
      return jsonResponse({ error: "unauthorized" }, request, env, 401);
    }
    const dryRunParam = (url.searchParams.get("dryRun") || "").toLowerCase();
    const dryRun = dryRunParam === "1" || dryRunParam === "true" || dryRunParam === "yes";
    const liveId = decodeURIComponent(livePostMatch[1]);
    const siteData = await getSiteData(env);
    const live = findLiveById(siteData, liveId);
    if (!live) {
      return jsonResponse({ error: "live not found" }, request, env, 404);
    }

    const tweetText = buildTweetText(live, env);
    if (dryRun) {
      try {
        const account = await verifyXCredentials(env);
        return jsonResponse(
          {
            ok: true,
            dryRun: true,
            liveId,
            tweetText,
            account,
            createdAt: nowIso(),
          },
          request,
          env
        );
      } catch (error) {
        return jsonResponse(
          {
            error: error.message,
            liveId,
            dryRun: true,
            tweetText,
          },
          request,
          env,
          500
        );
      }
    }

    try {
      const tweet = await postTweetToX(env, tweetText);
      await recordPostLog(env, {
        liveId,
        status: "success",
        tweetId: tweet.tweetId,
        tweetUrl: tweet.url,
        tweetText,
      });
      return jsonResponse(
        {
          ok: true,
          liveId,
          tweet,
          createdAt: nowIso(),
        },
        request,
        env
      );
    } catch (error) {
      await recordPostLog(env, {
        liveId,
        status: "failed",
        tweetText,
        errorMessage: error.message,
      });
      return jsonResponse(
        {
          error: error.message,
          liveId,
        },
        request,
        env,
        500
      );
    }
  }

  return jsonResponse({ error: "not found" }, request, env, 404);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      return jsonResponse(
        { error: error.message || "internal error" },
        request,
        env,
        500
      );
    }
  },
};
