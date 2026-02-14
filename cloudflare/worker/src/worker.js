const DEFAULT_SITE_DATA = {
  news: [],
  live: { ticketLink: "", upcoming: [], past: [] },
  discography: { digital: [], demo: [] },
  profile: { image: "", text: "", links: [] },
};

function nowIso() {
  return new Date().toISOString();
}

function generateId(prefix = "id") {
  return `${prefix}_${nowIso().replace(/[-:.TZ]/g, "")}_${makeNonce(10)}`;
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

function textResponse(body, request, env, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...headers,
      ...createCorsHeaders(request, env),
    },
  });
}

function sanitizeFilename(name) {
  const base = String(name || "image")
    .trim()
    .replace(/[/\\\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
  return base || "image";
}

function guessExtFromContentType(contentType) {
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("image/jpeg")) return "jpg";
  if (ct.includes("image/png")) return "png";
  if (ct.includes("image/webp")) return "webp";
  if (ct.includes("image/gif")) return "gif";
  return "bin";
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

async function serveImage(request, env, key) {
  if (!env.IMAGES) {
    return new Response("image storage not configured", { status: 500 });
  }
  const safeKey = String(key || "").replace(/^\/+/, "");
  if (!safeKey || safeKey.includes("..")) {
    return new Response("bad key", { status: 400 });
  }
  const obj = await env.IMAGES.get(safeKey);
  if (!obj) return new Response("not found", { status: 404 });

  const headers = new Headers();
  const contentType = obj.httpMetadata?.contentType || "application/octet-stream";
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("ETag", obj.etag);
  // Allow images to be embedded anywhere.
  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(obj.body, { status: 200, headers });
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

function isValidEmail(email) {
  const value = String(email || "").trim();
  if (value.length < 5 || value.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

async function createTicketReservation(env, input) {
  const liveId = String(input.liveId || "").trim();
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim();
  const message = String(input.message || "").trim();
  const quantity = clampInt(input.quantity, 1, 10);

  if (!liveId) throw new Error("liveId is required");
  if (!name) throw new Error("name is required");
  if (!isValidEmail(email)) throw new Error("email is invalid");

  const siteData = await getSiteData(env);
  const live = findLiveById(siteData, liveId);
  if (!live) throw new Error("live not found");

  // Basic de-dupe: same live+email within 5 minutes.
  const dedupe = await env.DB.prepare(
    `SELECT id FROM ticket_reservations
     WHERE live_id = ? AND email = ? AND created_at >= datetime('now', '-5 minutes')
     ORDER BY created_at DESC LIMIT 1`
  ).bind(liveId, email).first();
  if (dedupe?.id) throw new Error("reservation already submitted recently");

  const id = generateId("ticket");
  const createdAt = nowIso();
  const status = "pending";

  await env.DB.prepare(
    `INSERT INTO ticket_reservations
      (id, live_id, live_date, live_venue, name, email, quantity, message, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    liveId,
    String(live.date || ""),
    String(live.venue || ""),
    name,
    email,
    quantity,
    message,
    status,
    createdAt,
    createdAt
  ).run();

  return {
    id,
    liveId,
    liveDate: String(live.date || ""),
    liveVenue: String(live.venue || ""),
    name,
    email,
    quantity,
    message,
    status,
    createdAt,
  };
}

async function listTicketReservations(env, options = {}) {
  const liveId = String(options.liveId || "").trim();
  const status = String(options.status || "").trim();
  const limit = clampInt(options.limit, 1, 200);

  let stmt;
  if (liveId && status) {
    stmt = env.DB.prepare(
      `SELECT id, live_id as liveId, live_date as liveDate, live_venue as liveVenue,
              name, email, quantity, message, status, created_at as createdAt, updated_at as updatedAt
       FROM ticket_reservations
       WHERE live_id = ? AND status = ?
       ORDER BY created_at DESC
       LIMIT ?`
    ).bind(liveId, status, limit);
  } else if (liveId) {
    stmt = env.DB.prepare(
      `SELECT id, live_id as liveId, live_date as liveDate, live_venue as liveVenue,
              name, email, quantity, message, status, created_at as createdAt, updated_at as updatedAt
       FROM ticket_reservations
       WHERE live_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    ).bind(liveId, limit);
  } else if (status) {
    stmt = env.DB.prepare(
      `SELECT id, live_id as liveId, live_date as liveDate, live_venue as liveVenue,
              name, email, quantity, message, status, created_at as createdAt, updated_at as updatedAt
       FROM ticket_reservations
       WHERE status = ?
       ORDER BY created_at DESC
       LIMIT ?`
    ).bind(status, limit);
  } else {
    stmt = env.DB.prepare(
      `SELECT id, live_id as liveId, live_date as liveDate, live_venue as liveVenue,
              name, email, quantity, message, status, created_at as createdAt, updated_at as updatedAt
       FROM ticket_reservations
       ORDER BY created_at DESC
       LIMIT ?`
    ).bind(limit);
  }

  const result = await stmt.all();
  return result.results || [];
}

async function updateTicketReservationStatus(env, id, status) {
  const allowed = new Set(["pending", "handled", "cancelled"]);
  const next = String(status || "").trim();
  if (!allowed.has(next)) throw new Error("invalid status");

  const updatedAt = nowIso();
  const res = await env.DB.prepare(
    `UPDATE ticket_reservations SET status = ?, updated_at = ? WHERE id = ?`
  ).bind(next, updatedAt, id).run();

  if (!res.success) throw new Error("update failed");
  return { id, status: next, updatedAt };
}

function toCsv(rows) {
  const header = [
    "id",
    "status",
    "createdAt",
    "updatedAt",
    "liveId",
    "liveDate",
    "liveVenue",
    "name",
    "email",
    "quantity",
    "message",
  ];
  const escape = (v) => {
    const s = String(v ?? "");
    if (/[\",\n\r]/.test(s)) return `"${s.replace(/\"/g, "\"\"")}"`;
    return s;
  };
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.status,
        r.createdAt,
        r.updatedAt,
        r.liveId,
        r.liveDate,
        r.liveVenue,
        r.name,
        r.email,
        r.quantity,
        r.message,
      ].map(escape).join(",")
    );
  }
  return lines.join("\n") + "\n";
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

  const imageMatch = path.match(/^\/images\/(.+)$/);
  if (imageMatch && request.method === "GET") {
    return serveImage(request, env, decodeURIComponent(imageMatch[1]));
  }

  if (path === "/api/public/site-data" && request.method === "GET") {
    const data = await getSiteData(env);
    return jsonResponse({ data }, request, env);
  }

  if (path === "/api/public/ticket-reservations" && request.method === "POST") {
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return jsonResponse({ error: "invalid payload" }, request, env, 400);
    }
    // Honeypot
    if (payload.company) {
      return jsonResponse({ ok: true }, request, env);
    }
    try {
      const reservation = await createTicketReservation(env, payload);
      return jsonResponse({ ok: true, reservation }, request, env, 201);
    } catch (error) {
      return jsonResponse({ error: error.message }, request, env, 400);
    }
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

  if (path === "/api/admin/ticket-reservations" && request.method === "GET") {
    if (!isAdminAuthorized(request, env)) {
      return jsonResponse({ error: "unauthorized" }, request, env, 401);
    }
    const liveId = url.searchParams.get("liveId") || "";
    const status = url.searchParams.get("status") || "";
    const limit = url.searchParams.get("limit") || "100";
    const reservations = await listTicketReservations(env, { liveId, status, limit });
    return jsonResponse({ reservations }, request, env);
  }

  if (path === "/api/admin/ticket-reservations.csv" && request.method === "GET") {
    if (!isAdminAuthorized(request, env)) {
      return jsonResponse({ error: "unauthorized" }, request, env, 401);
    }
    const liveId = url.searchParams.get("liveId") || "";
    const status = url.searchParams.get("status") || "";
    const limit = url.searchParams.get("limit") || "200";
    const rows = await listTicketReservations(env, { liveId, status, limit });
    const csv = toCsv(rows);
    return textResponse(csv, request, env, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"ticket_reservations.csv\"",
    });
  }

  const ticketStatusMatch = path.match(/^\/api\/admin\/ticket-reservations\/([^/]+)\/status$/);
  if (ticketStatusMatch && request.method === "POST") {
    if (!isAdminAuthorized(request, env)) {
      return jsonResponse({ error: "unauthorized" }, request, env, 401);
    }
    const id = decodeURIComponent(ticketStatusMatch[1]);
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return jsonResponse({ error: "invalid payload" }, request, env, 400);
    }
    try {
      const updated = await updateTicketReservationStatus(env, id, payload.status);
      return jsonResponse({ ok: true, updated }, request, env);
    } catch (error) {
      return jsonResponse({ error: error.message }, request, env, 400);
    }
  }

  if (path === "/api/admin/upload-image" && request.method === "POST") {
    if (!isAdminAuthorized(request, env)) {
      return jsonResponse({ error: "unauthorized" }, request, env, 401);
    }
    if (!env.IMAGES) {
      return jsonResponse({ error: "image storage not configured" }, request, env, 500);
    }

    const form = await request.formData().catch(() => null);
    if (!form) return jsonResponse({ error: "invalid form" }, request, env, 400);

    const file = form.get("file");
    if (!file || typeof file !== "object" || typeof file.arrayBuffer !== "function") {
      return jsonResponse({ error: "file is required" }, request, env, 400);
    }

    const contentType = file.type || "application/octet-stream";
    if (!String(contentType).toLowerCase().startsWith("image/")) {
      return jsonResponse({ error: "only image/* is allowed" }, request, env, 400);
    }

    const size = Number(file.size || 0);
    const maxBytes = 5 * 1024 * 1024;
    if (size <= 0 || size > maxBytes) {
      return jsonResponse({ error: "file too large (max 5MB)" }, request, env, 400);
    }

    const original = sanitizeFilename(file.name || "");
    const ext = guessExtFromContentType(contentType);
    const nonce = makeNonce(12);
    const yyyyMmDd = nowIso().slice(0, 10).replace(/-/g, "");
    const key = `uploads/${yyyyMmDd}/${nonce}_${original}.${ext}`;

    const bytes = await file.arrayBuffer();
    await env.IMAGES.put(key, bytes, {
      httpMetadata: { contentType },
    });

    const publicUrl = `${url.origin}/images/${encodeURIComponent(key)}`;
    return jsonResponse({ ok: true, key, url: publicUrl }, request, env);
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
