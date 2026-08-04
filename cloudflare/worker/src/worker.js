const DEFAULT_SITE_DATA = {
  news: [],
  live: { ticketLink: "", upcoming: [], past: [] },
  discography: { digital: [], demo: [] },
  profile: { image: "", text: "", links: [] },
  youtube: { channelUrl: "https://www.youtube.com/@1212____ki", musicVideos: [], liveMovies: [], demos: [] },
  site: {
    heroImage: "assets/images/hero.jpg",
    links: {
      bandcamp: "https://1212ki.bandcamp.com/",
      youtube: "https://www.youtube.com/@1212____ki",
      x: "https://www.x.com/1212____ki",
      instagram: "https://www.instagram.com/1212____ki",
      note: "https://note.com/1212_4939/m/m466c3962969c",
    },
    footerText: "© 2025 松本一樹 -itsuki matsumoto-. All rights reserved.",
  },
  ticket: {
    introText: "ライブを選択して、必要事項を入力してください。",
    noticeText: "送信後、入力したe-mail宛に受付内容の自動返信をお送りします。",
    completeText: "予約しました。入力したe-mail宛に受付内容の自動返信をお送りします。",
    fields: {
      showQuantity: true,
      showMessage: true,
      labelQuantity: "枚数",
      labelMessage: "備考",
      placeholderMessage: "例: 取り置き名義が別の場合など",
      submitLabel: "予約する",
    },
  },
  contact: {
    introText: "お問い合わせは以下のフォームに必要事項をご入力の上、送信してください。",
    formAction: "https://formspree.io/f/xqaeddgj",
  },
};
const TOKYO_UTC_OFFSET_MS = 9 * 60 * 60 * 1000;
const LIVE_AI_SOURCE_MAX_LENGTH = 12_000;
const LIVE_AI_TIMEOUT_MS = 15_000;
const LIVE_AI_DRAFT_KEYS = ["date", "title", "venue", "description", "ticketUrl", "link"];
const LIVE_AI_DRAFT_LIMITS = {
  date: 10,
  title: 300,
  venue: 300,
  description: 10_000,
  ticketUrl: 2_048,
  link: 2_048,
};
const LIVE_AI_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: Object.fromEntries(LIVE_AI_DRAFT_KEYS.map((key) => [key, { type: "string" }])),
  required: LIVE_AI_DRAFT_KEYS,
};
const LIVE_AI_INSTRUCTIONS = [
  "ライブ／公演の元情報を、指定された6項目へ整理してください。",
  "原文にない情報は補わず、判断できない項目は空文字にしてください。",
  "dateは判断できる場合だけYYYY.MM.DD形式にしてください。",
  "ticketUrlにはチケットの予約または購入先URLだけを入れてください。",
  "linkには公演詳細やSNSなど、予約・購入先ではない関連URLを入れてください。",
  "descriptionにはOPEN、START、料金、出演者など独立項目のない情報を読みやすく整理してください。",
].join("\n");

class SiteDataValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SiteDataValidationError";
  }
}

class PublicReservationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PublicReservationError";
  }
}

class KnownClientError extends Error {
  constructor(message) {
    super(message);
    this.name = "KnownClientError";
  }
}

class LiveAiProviderError extends Error {
  constructor() {
    super("AI source intake failed");
    this.name = "LiveAiProviderError";
  }
}

class LiveAiTimeoutError extends Error {
  constructor() {
    super("AI source intake timed out");
    this.name = "LiveAiTimeoutError";
  }
}

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

  data.youtube = data.youtube && typeof data.youtube === "object" ? data.youtube : base.youtube;
  data.youtube.channelUrl = data.youtube.channelUrl || base.youtube.channelUrl;
  data.youtube.musicVideos = Array.isArray(data.youtube.musicVideos) ? data.youtube.musicVideos : [];
  data.youtube.liveMovies = Array.isArray(data.youtube.liveMovies) ? data.youtube.liveMovies : [];
  data.youtube.demos = Array.isArray(data.youtube.demos) ? data.youtube.demos : [];

  data.site = data.site && typeof data.site === "object" ? data.site : base.site;
  data.site.heroImage = data.site.heroImage || base.site.heroImage;
  data.site.links = data.site.links && typeof data.site.links === "object" ? data.site.links : base.site.links;
  data.site.links.bandcamp = data.site.links.bandcamp || base.site.links.bandcamp;
  data.site.links.youtube = data.site.links.youtube || base.site.links.youtube;
  data.site.links.x = data.site.links.x || base.site.links.x;
  data.site.links.instagram = data.site.links.instagram || base.site.links.instagram;
  data.site.links.note = data.site.links.note || base.site.links.note;
  data.site.footerText = data.site.footerText || base.site.footerText;

  data.ticket = data.ticket && typeof data.ticket === "object" ? data.ticket : base.ticket;
  data.ticket.introText = data.ticket.introText || base.ticket.introText;
  data.ticket.noticeText = data.ticket.noticeText || base.ticket.noticeText;
  data.ticket.completeText = data.ticket.completeText || base.ticket.completeText;
  data.ticket.fields = data.ticket.fields && typeof data.ticket.fields === "object" ? data.ticket.fields : base.ticket.fields;
  data.ticket.fields.showQuantity = data.ticket.fields.showQuantity !== false;
  data.ticket.fields.showMessage = data.ticket.fields.showMessage !== false;
  data.ticket.fields.labelQuantity = data.ticket.fields.labelQuantity || base.ticket.fields.labelQuantity;
  data.ticket.fields.labelMessage = data.ticket.fields.labelMessage || base.ticket.fields.labelMessage;
  data.ticket.fields.placeholderMessage = data.ticket.fields.placeholderMessage || base.ticket.fields.placeholderMessage;
  data.ticket.fields.submitLabel = data.ticket.fields.submitLabel || base.ticket.fields.submitLabel;

  data.contact = data.contact && typeof data.contact === "object" ? data.contact : base.contact;
  data.contact.introText = data.contact.introText || base.contact.introText;
  data.contact.formAction = data.contact.formAction || base.contact.formAction;
  return data;
}

function projectPublicSiteData(data) {
  const projected = structuredClone(data);
  for (const collection of ["upcoming", "past"]) {
    const lives = projected?.live?.[collection];
    if (!Array.isArray(lives)) continue;
    for (const live of lives) {
      if (!live || typeof live !== "object") continue;
      delete live.sourceText;
      delete live.xComment;
    }
  }
  return projected;
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
      "Cache-Control": "no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Pragma": "no-cache",
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

function htmlResponse(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...headers,
    },
  });
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function truncate(str, maxLen) {
  const s = String(str || "");
  if (s.length <= maxLen) return s;
  return s.slice(0, Math.max(0, maxLen - 1)) + "…";
}

function isOgCrawler(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (!ua) return false;
  return (
    ua.includes("twitterbot") ||
    ua.includes("facebookexternalhit") ||
    ua.includes("slackbot") ||
    ua.includes("discordbot") ||
    ua.includes("linkedinbot") ||
    ua.includes("whatsapp") ||
    ua.includes("telegrambot")
  );
}

function buildCompactDescription(raw) {
  const txt = String(raw || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r\n/g, "\n");
  const parts = txt
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return parts.join(" / ");
}

function resolveOgImageUrl(raw, ogOrigin, publicOrigin, env) {
  const v = String(raw || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;

  const looksStatic = v.startsWith("assets/") || v.startsWith("/assets/");
  if (looksStatic) {
    return resolvePublicImageUrl(v, publicOrigin, env);
  }

  return resolvePublicImageUrl(v, ogOrigin, env);
}

function buildOgLiveHtml({ pageUrl, canonicalUrl, title, description, imageUrl }) {
  const safeTitle = escapeHtml(title || "");
  const safeDesc = escapeHtml(description || "");
  const safePageUrl = escapeHtml(pageUrl || "");
  const safeCanonical = escapeHtml(canonicalUrl || "");
  const safeImg = escapeHtml(imageUrl || "");
  const safeCanonicalJs = JSON.stringify(String(canonicalUrl || ""));

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${safeTitle}</title>
  ${canonicalUrl ? `<link rel="canonical" href="${safeCanonical}" />` : ""}

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="松本一樹" />
  <meta property="og:url" content="${safePageUrl}" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  ${imageUrl ? `<meta property="og:image" content="${safeImg}" />` : ""}

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />
  ${imageUrl ? `<meta name="twitter:image" content="${safeImg}" />` : ""}

  <style>
    :root { color-scheme: light; }
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; padding: 24px; background: #fff; color: #111; }
    .card { max-width: 720px; margin: 0 auto; border: 1px solid rgba(0,0,0,0.12); border-radius: 16px; padding: 18px; }
    h1 { font-size: 18px; margin: 0 0 10px; }
    p { margin: 0 0 14px; color: #444; line-height: 1.6; white-space: pre-wrap; }
    a { color: #111; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px 14px; border-radius: 999px; border: 1px solid rgba(0,0,0,0.12); text-decoration: none; }
  </style>
</head>
<body>
  <main class="card">
    <h1>${safeTitle}</h1>
    <p>${safeDesc}</p>
    ${canonicalUrl ? `<a class="btn" href="${safeCanonical}" rel="noopener">詳細を見る</a>` : ""}
  </main>
  ${canonicalUrl ? `
  <script>
    // X/Twitter card bots do not execute JS. For humans, redirect quickly to the canonical HP URL.
    try { setTimeout(function () { location.replace(${safeCanonicalJs}); }, 30); } catch (e) {}
  </script>` : ""}
</body>
</html>`;
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

function isValidLiveAiDate(value) {
  const match = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const leapYear = year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

function isValidLiveAiUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch (_error) {
    return false;
  }
}

function validateLiveAiDraft(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new LiveAiProviderError();
  }

  const keys = Object.keys(input);
  if (
    keys.length !== LIVE_AI_DRAFT_KEYS.length ||
    !LIVE_AI_DRAFT_KEYS.every((key) => Object.prototype.hasOwnProperty.call(input, key))
  ) {
    throw new LiveAiProviderError();
  }

  const draft = {};
  for (const key of LIVE_AI_DRAFT_KEYS) {
    if (typeof input[key] !== "string") throw new LiveAiProviderError();
    const value = input[key].trim();
    if (value.length > LIVE_AI_DRAFT_LIMITS[key]) throw new LiveAiProviderError();
    draft[key] = value;
  }

  if (draft.date && !isValidLiveAiDate(draft.date)) throw new LiveAiProviderError();
  if (!isValidLiveAiUrl(draft.ticketUrl) || !isValidLiveAiUrl(draft.link)) {
    throw new LiveAiProviderError();
  }
  return draft;
}

function hasLiveAiRefusal(payload) {
  if (typeof payload?.refusal === "string" && payload.refusal.trim()) return true;
  if (!Array.isArray(payload?.output)) return false;
  return payload.output.some((item) => (
    Array.isArray(item?.content) && item.content.some((content) => (
      content?.type === "refusal" ||
      (typeof content?.refusal === "string" && content.refusal.trim())
    ))
  ));
}

function extractLiveAiOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }
  if (!Array.isArray(payload?.output)) return "";
  for (const item of payload.output) {
    if (!Array.isArray(item?.content)) continue;
    for (const content of item.content) {
      if (content?.type === "output_text" && typeof content.text === "string" && content.text.trim()) {
        return content.text;
      }
    }
  }
  return "";
}

async function requestLiveAiDraft(env, sourceText) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIVE_AI_TIMEOUT_MS);
  let payload;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: String(env.LIVE_AI_MODEL || "").trim() || "gpt-5-mini",
        instructions: LIVE_AI_INSTRUCTIONS,
        input: sourceText,
        text: {
          format: {
            type: "json_schema",
            name: "live_source_intake",
            strict: true,
            schema: LIVE_AI_OUTPUT_SCHEMA,
          },
        },
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new LiveAiProviderError();
    payload = await response.json();
  } catch (error) {
    if (controller.signal.aborted) throw new LiveAiTimeoutError();
    if (error instanceof LiveAiProviderError) throw error;
    throw new LiveAiProviderError();
  } finally {
    clearTimeout(timeout);
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    payload.error ||
    (payload.status && payload.status !== "completed") ||
    hasLiveAiRefusal(payload)
  ) {
    throw new LiveAiProviderError();
  }

  const outputText = extractLiveAiOutputText(payload);
  if (!outputText) throw new LiveAiProviderError();

  let parsed;
  try {
    parsed = JSON.parse(outputText);
  } catch (_error) {
    throw new LiveAiProviderError();
  }
  return validateLiveAiDraft(parsed);
}

async function serveImage(request, env, key) {
  if (!env.IMAGES) {
    return new Response("image storage not configured", { status: 500 });
  }
  const safeKey = String(key || "").replace(/^\/+/, "");
  if (!safeKey || safeKey.includes("..")) {
    return new Response("bad key", { status: 400 });
  }
  const method = String(request.method || "GET").toUpperCase();
  const obj = method === "HEAD" ? await env.IMAGES.head(safeKey) : await env.IMAGES.get(safeKey);
  if (!obj) return new Response("not found", { status: 404 });

  const headers = new Headers();
  const contentType = obj.httpMetadata?.contentType || "application/octet-stream";
  headers.set("Content-Type", contentType);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("ETag", obj.etag);
  // Allow images to be embedded anywhere.
  headers.set("Access-Control-Allow-Origin", "*");

  return new Response(method === "HEAD" ? null : obj.body, { status: 200, headers });
}

async function getSiteDataRow(env) {
  const row = await env.DB.prepare("SELECT data, updated_at FROM site_data WHERE id = 1").first();
  if (!row || !row.data) {
    const fallback = normalizeSiteData(DEFAULT_SITE_DATA);
    const updatedAt = nowIso();
    await env.DB.prepare(
      "INSERT OR REPLACE INTO site_data (id, data, updated_at) VALUES (1, ?, ?)"
    ).bind(JSON.stringify(fallback), updatedAt).run();
    return { data: fallback, updatedAt };
  }
  try {
    return { data: normalizeSiteData(JSON.parse(row.data)), updatedAt: row.updated_at || "" };
  } catch (_error) {
    return { data: normalizeSiteData(DEFAULT_SITE_DATA), updatedAt: row.updated_at || "" };
  }
}

async function getSiteData(env) {
  const { data } = await getSiteDataRow(env);
  return data;
}

async function saveSiteData(env, data) {
  const duplicateLiveIds = findDuplicateLiveIds(data);
  if (duplicateLiveIds.length > 0) {
    throw new SiteDataValidationError(`duplicate Live ID: ${duplicateLiveIds.join(", ")}`);
  }
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
  const quantity = input.quantity;

  if (!liveId) throw new PublicReservationError("liveId is required");
  if (!name) throw new PublicReservationError("name is required");
  if (!isValidEmail(email)) throw new PublicReservationError("email is invalid");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new PublicReservationError("quantity is invalid");
  }

  const siteData = await getSiteData(env);
  const resolvedLive = resolveLiveById(siteData, liveId);
  if (resolvedLive.status === "ambiguous") throw new PublicReservationError("live ID is ambiguous");
  if (resolvedLive.status !== "unique") throw new PublicReservationError("live not found");
  const live = resolvedLive.live;
  if (!isPublicTicketReservationEligible(siteData, liveId)) {
    throw new PublicReservationError("live is not available for public reservation");
  }

  const id = generateId("ticket");
  const createdAt = nowIso();
  const duplicateThreshold = new Date(Date.parse(createdAt) - 5 * 60 * 1000).toISOString();
  const status = "pending";

  const insertResult = await env.DB.prepare(
    `INSERT INTO ticket_reservations
      (id, live_id, live_date, live_venue, name, email, quantity, message, status, created_at, updated_at, source)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM ticket_reservations
       WHERE live_id = ? AND email = ? AND created_at >= ?
     )`
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
    createdAt,
    "web",
    liveId,
    email,
    duplicateThreshold
  ).run();
  if (Number(insertResult?.meta?.changes) === 0) {
    throw new PublicReservationError("reservation already submitted recently");
  }

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
    source: "web",
    createdAt,
  };
}

async function createManualTicketReservation(env, input) {
  const liveId = typeof input.liveId === "string" ? input.liveId.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const quantity = input.quantity;

  if (!liveId) throw new KnownClientError("liveId is required");
  if (!name) throw new KnownClientError("name is required");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new KnownClientError("quantity is invalid");
  }
  if (input.contact != null && typeof input.contact !== "string") {
    throw new KnownClientError("contact is invalid");
  }
  if (input.internalNote != null && typeof input.internalNote !== "string") {
    throw new KnownClientError("internalNote is invalid");
  }

  const contact = String(input.contact || "").trim();
  const internalNote = String(input.internalNote || "").trim();
  if (contact.length > 200) throw new KnownClientError("contact is too long");
  if (internalNote.length > 2000) throw new KnownClientError("internalNote is too long");

  const siteData = await getSiteData(env);
  const resolvedLive = resolveLiveById(siteData, liveId);
  if (resolvedLive.status === "ambiguous") throw new KnownClientError("live ID is ambiguous");
  if (resolvedLive.status !== "unique") throw new KnownClientError("live not found");
  const live = resolvedLive.live;

  const id = generateId("ticket");
  const createdAt = nowIso();
  const status = "handled";
  const source = "manual";

  await env.DB.prepare(
    `INSERT INTO ticket_reservations
      (id, live_id, live_date, live_venue, name, email, quantity, message, status, created_at, updated_at, source, contact, internal_note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    liveId,
    String(live.date || ""),
    String(live.venue || ""),
    name,
    "",
    quantity,
    "",
    status,
    createdAt,
    createdAt,
    source,
    contact,
    internalNote
  ).run();

  return {
    id,
    liveId,
    liveDate: String(live.date || ""),
    liveVenue: String(live.venue || ""),
    name,
    email: "",
    quantity,
    message: "",
    status,
    source,
    contact,
    internalNote,
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
              name, email, quantity, message, status, created_at as createdAt, updated_at as updatedAt,
              COALESCE(source, 'web') as source, contact, internal_note as internalNote
       FROM ticket_reservations
       WHERE live_id = ? AND status = ?
       ORDER BY created_at DESC
       LIMIT ?`
    ).bind(liveId, status, limit);
  } else if (liveId) {
    stmt = env.DB.prepare(
      `SELECT id, live_id as liveId, live_date as liveDate, live_venue as liveVenue,
              name, email, quantity, message, status, created_at as createdAt, updated_at as updatedAt,
              COALESCE(source, 'web') as source, contact, internal_note as internalNote
       FROM ticket_reservations
       WHERE live_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    ).bind(liveId, limit);
  } else if (status) {
    stmt = env.DB.prepare(
      `SELECT id, live_id as liveId, live_date as liveDate, live_venue as liveVenue,
              name, email, quantity, message, status, created_at as createdAt, updated_at as updatedAt,
              COALESCE(source, 'web') as source, contact, internal_note as internalNote
       FROM ticket_reservations
       WHERE status = ?
       ORDER BY created_at DESC
       LIMIT ?`
    ).bind(status, limit);
  } else {
    stmt = env.DB.prepare(
      `SELECT id, live_id as liveId, live_date as liveDate, live_venue as liveVenue,
              name, email, quantity, message, status, created_at as createdAt, updated_at as updatedAt,
              COALESCE(source, 'web') as source, contact, internal_note as internalNote
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
  if (!allowed.has(next)) throw new KnownClientError("invalid status");

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
    "source",
    "contact",
    "internalNote",
  ];
  const escape = (v) => {
    const raw = String(v ?? "");
    const s = typeof v === "string" && /^[\s\x00-\x1f\x7f-\x9f]*[=+\-@]/.test(v)
      ? `'${raw}`
      : raw;
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
        r.source || "web",
        r.contact,
        r.internalNote,
      ].map(escape).join(",")
    );
  }
  return lines.join("\n") + "\n";
}

function getLiveEntries(siteData) {
  const live = siteData && siteData.live && typeof siteData.live === "object" ? siteData.live : {};
  const upcoming = Array.isArray(live.upcoming) ? live.upcoming : [];
  const past = Array.isArray(live.past) ? live.past : [];
  return [
    ...upcoming.map((item) => ({ live: item, category: "upcoming" })),
    ...past.map((item) => ({ live: item, category: "past" })),
  ];
}

function normalizeLiveId(value) {
  return String(value == null ? "" : value).trim();
}

function resolveLiveById(siteData, liveId) {
  const id = normalizeLiveId(liveId);
  const matches = id
    ? getLiveEntries(siteData).filter((entry) => normalizeLiveId(entry.live && entry.live.id) === id)
    : [];
  if (matches.length === 0) return { status: "missing", live: null, category: null };
  if (matches.length !== 1) return { status: "ambiguous", live: null, category: null };
  return { status: "unique", live: matches[0].live, category: matches[0].category };
}

function findDuplicateLiveIds(siteData) {
  const counts = new Map();
  for (const entry of getLiveEntries(siteData)) {
    const id = normalizeLiveId(entry.live && entry.live.id);
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();
}

function findLiveById(siteData, liveId) {
  const resolved = resolveLiveById(siteData, liveId);
  return resolved.status === "unique" ? resolved.live : null;
}

const PUBLIC_RESERVATION_SOCIAL_HOSTS = [
  "instagram.com",
  "x.com",
  "twitter.com",
  "youtube.com",
  "youtu.be",
  "facebook.com",
  "fb.com",
  "tiktok.com",
  "threads.net",
  "bandcamp.com",
  "soundcloud.com",
  "spotify.com",
];

const PUBLIC_RESERVATION_TICKET_HOSTS = [
  "tiget.net",
  "eplus.jp",
  "pia.jp",
  "l-tike.com",
  "livepocket.jp",
  "zaiko.io",
  "peatix.com",
  "teket.jp",
  "ticketpay.jp",
  "confetti-web.com",
  "rakuten-ticket.com",
  "ticketbook.jp",
  "eventregist.com",
];

function hasOwn(object, property) {
  return object != null && Object.prototype.hasOwnProperty.call(object, property);
}

function cleanPublicReservationUrl(value) {
  return String(value == null ? "" : value).trim()
    .replace(/^[\s\u300c\u300e\u3010(<\[]+/u, "")
    .replace(/[\s\u300d\u300f\u3011。、，．!！?？;；:：)>\]}]+$/u, "");
}

function parseSafePublicReservationUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value == null ? "" : value).trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    decodeURIComponent(parsed.pathname);
    decodeURIComponent(parsed.search);
    decodeURIComponent(parsed.hash);
  } catch (_error) {
    return null;
  }
  return parsed;
}

function publicReservationHostMatches(hostname, candidate) {
  return hostname === candidate || hostname.endsWith(`.${candidate}`);
}

function isRecognizablePublicBookingUrl(value) {
  const cleaned = cleanPublicReservationUrl(value);
  const parsed = parseSafePublicReservationUrl(cleaned);
  if (!parsed) return false;

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (PUBLIC_RESERVATION_SOCIAL_HOSTS.some((candidate) => publicReservationHostMatches(hostname, candidate))) {
    return false;
  }
  const path = decodeURIComponent(parsed.pathname).toLowerCase();
  if (/(?:^|\/)profile(?:\/|$)/.test(path)) return false;
  if (/(?:^|\/)live\/detail(?:\/|$)/.test(path)) return false;
  if (hostname === "ssl.form-mailer.jp" && /^\/fms\/[a-z0-9_-]+\/?$/i.test(path)) return true;
  if (PUBLIC_RESERVATION_TICKET_HOSTS.some((candidate) => publicReservationHostMatches(hostname, candidate))) {
    return true;
  }
  if (/(?:^|[\/_.-])(?:tickets?|reserve|reservation|reservations|booking)(?:$|[\/_.-])/.test(path)) {
    return true;
  }
  for (const key of parsed.searchParams.keys()) {
    if (/^(?:ticket|tickets|reserve|reservation|booking)$/i.test(key)) return true;
  }
  return false;
}

function parsePublicReservationLiveDate(value) {
  const text = String(value == null ? "" : value);
  const match = text.match(/(20\d{2})\s*(?:[.\/-]|年)\s*(\d{1,2})\s*(?:[.\/-]|月)\s*(\d{1,2})\s*日?/u);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function isPublicReservationPastLive(live) {
  if (live.isPast === true || live.past === true) return true;
  const parsed = parsePublicReservationLiveDate(live.date);
  if (!parsed) return false;

  const now = new Date();
  const tokyoNow = new Date(now.getTime() + TOKYO_UTC_OFFSET_MS);
  const today = Date.UTC(tokyoNow.getUTCFullYear(), tokyoNow.getUTCMonth(), tokyoNow.getUTCDate());
  const liveDate = Date.UTC(parsed.year, parsed.month - 1, parsed.day);
  return liveDate < today;
}

function isPublicTicketReservationEligible(siteData, liveId) {
  const resolved = resolveLiveById(siteData, liveId);
  if (resolved.status !== "unique" || resolved.category !== "upcoming") return false;
  const live = resolved.live;
  if (live.reservationClosed === true || isPublicReservationPastLive(live)) return false;

  if (hasOwn(live, "ticketUrl")) {
    return String(live.ticketUrl == null ? "" : live.ticketUrl).trim() === "";
  }
  return !isRecognizablePublicBookingUrl(live.link);
}

function buildTweetText(live, _env) {
  const rawDescription = String((live && live.description) || "").replace(/<br\s*\/?>/gi, "\n");
  const descLines = rawDescription
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const header = "【LIVE】";
  const eventTitle = String(live?.title || "").trim();
  const heading = `${String(live?.date || "日付未設定").trim()} ${String(live?.venue || "").trim()}`.trim();

  const blocks = [header];
  if (eventTitle) blocks.push(eventTitle);
  if (heading) blocks.push(heading);
  if (descLines.length > 0) {
    blocks.push("");
    blocks.push(...descLines);
  }

  let text = blocks.join("\n").trim();
  if (text.length <= 280) return text;

  text = [header, eventTitle, heading, ...descLines].filter(Boolean).join("\n").trim();
  if (text.length <= 280) return text;

  const compact = descLines.join(" / ");
  const shortened = compact ? compact.slice(0, 120) + "…" : "";
  text = [header, eventTitle, heading, shortened].filter(Boolean).join("\n").trim();
  if (text.length <= 280) return text;

  text = [header, eventTitle, heading].filter(Boolean).join("\n").trim();
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

function resolvePublicImageUrl(raw, fallbackOrigin, env) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;

  const envOrigin = String(env?.PUBLIC_ORIGIN || env?.SITE_ORIGIN || "")
    .trim()
    .replace(/\/+$/, "");
  const origin = String(fallbackOrigin || envOrigin || "").trim().replace(/\/+$/, "");
  if (!origin) return "";

  if (value.startsWith("/")) return origin + value;

  const normalized = value.replace(/^\.\//, "").replace(/^\.\.\//, "");
  return `${origin}/${normalized}`;
}

function guessPublicOrigin(env) {
  const direct = String(env?.PUBLIC_ORIGIN || env?.SITE_ORIGIN || "")
    .trim()
    .replace(/\/+$/, "");
  if (direct) return direct;

  const allowed = String(env?.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\/+$/, ""));

  // Prefer public site over admin origin if present.
  const preferred = allowed.find((s) => !/\/\/admin\./i.test(s)) || allowed[0] || "";
  return String(preferred || "").trim().replace(/\/+$/, "");
}

async function fetchImageBytes(imageUrl) {
  const url = String(imageUrl || "").trim();
  if (!url) throw new Error("image url is empty");

  const res = await fetch(url, { cf: { cacheTtl: 0, cacheEverything: false } });
  if (!res.ok) throw new Error(`image fetch failed: ${res.status}`);

  const contentType = String(res.headers.get("Content-Type") || "").toLowerCase();
  if (!contentType.startsWith("image/")) throw new Error("image is not image/*");

  const bytes = await res.arrayBuffer();
  const size = Number(bytes.byteLength || 0);
  const maxBytes = 5 * 1024 * 1024;
  if (size <= 0) throw new Error("image is empty");
  if (size > maxBytes) throw new Error("image too large (max 5MB)");

  return { bytes, contentType };
}

async function uploadMediaToX(env, bytes, contentType) {
  const { consumerKey, consumerSecret, accessToken, accessTokenSecret } = getXCredentials(env);
  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    throw new Error("X API認証情報が不足しています");
  }

  const method = "POST";
  const url = "https://upload.twitter.com/1.1/media/upload.json";
  const authHeader = await buildOAuthHeaderForX({
    method,
    url,
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret,
  });

  const form = new FormData();
  form.append(
    "media",
    new Blob([bytes], { type: contentType || "application/octet-stream" }),
    "flyer"
  );

  const response = await fetch(url, {
    method,
    headers: { Authorization: authHeader },
    body: form,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details =
      payload?.errors?.[0]?.message || payload?.error || payload?.detail || payload?.title || "unknown";
    throw new Error(`media upload failed: ${details}`);
  }

  const mediaId = payload?.media_id_string || (payload?.media_id ? String(payload.media_id) : "");
  if (!mediaId) throw new Error("media upload failed: no media id");
  return mediaId;
}

async function getFlyerMediaIds(env, live, fallbackOrigin) {
  if (!live) throw new Error("live not found");
  const raw = String(live.image || "").trim();
  if (!raw) return [];

  const imageUrl = resolvePublicImageUrl(raw, fallbackOrigin, env);
  if (!imageUrl) throw new Error("flyer url cannot be resolved (set PUBLIC_ORIGIN/SITE_ORIGIN/ALLOWED_ORIGINS)");

  const { bytes, contentType } = await fetchImageBytes(imageUrl);
  const mediaId = await uploadMediaToX(env, bytes, contentType);
  return mediaId ? [mediaId] : [];
}

async function postTweetToX(env, text, options = {}) {
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

  const body = { text: String(text || "") };
  const mediaIds = Array.isArray(options.mediaIds) ? options.mediaIds.filter(Boolean) : [];
  if (mediaIds.length > 0) {
    body.media = { media_ids: mediaIds };
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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

function isValidIsoDate(value) {
  const v = String(value || "").trim();
  if (!v) return false;
  const d = new Date(v);
  return Number.isFinite(d.getTime());
}

function toIso(value) {
  const d = value instanceof Date ? value : new Date(value);
  return new Date(d.getTime()).toISOString();
}

async function listXPosts(env, options = {}) {
  const liveId = String(options.liveId || "").trim();
  const limit = clampInt(options.limit, 1, 200);
  const stmt = liveId
    ? env.DB.prepare(
        `SELECT id, live_id as liveId, status, tweet_id as tweetId, tweet_url as tweetUrl, tweet_text as tweetText,
                error_message as errorMessage, created_at as createdAt
         FROM x_posts WHERE live_id = ? ORDER BY created_at DESC LIMIT ?`
      ).bind(liveId, limit)
    : env.DB.prepare(
        `SELECT id, live_id as liveId, status, tweet_id as tweetId, tweet_url as tweetUrl, tweet_text as tweetText,
                error_message as errorMessage, created_at as createdAt
         FROM x_posts ORDER BY created_at DESC LIMIT ?`
      ).bind(limit);
  const result = await stmt.all();
  return result.results || [];
}

async function createXPostSchedule(env, liveId, scheduledAtIso, tweetText) {
  const res = await env.DB.prepare(
    `INSERT INTO x_posts (live_id, status, tweet_id, tweet_url, tweet_text, error_message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(liveId, "scheduled", "", "", tweetText || "", "", scheduledAtIso).run();

  const id = res?.meta?.last_row_id || null;
  return { id, liveId, status: "scheduled", tweetText, createdAt: scheduledAtIso };
}

async function cancelScheduledXPost(env, id) {
  const row = await env.DB.prepare(
    `SELECT id, status FROM x_posts WHERE id = ? LIMIT 1`
  ).bind(id).first();
  if (!row) throw new KnownClientError("not found");
  if (String(row.status) !== "scheduled") throw new KnownClientError("not scheduled");
  await env.DB.prepare(
    `UPDATE x_posts SET status = ?, error_message = ? WHERE id = ?`
  ).bind("cancelled", "cancelled", id).run();
  return { id, status: "cancelled" };
}

async function executeDueXPostSchedules(env) {
  const now = nowIso();
  const result = await env.DB.prepare(
    `SELECT id, live_id as liveId, tweet_text as tweetText, created_at as createdAt
     FROM x_posts
     WHERE status = 'scheduled' AND created_at <= ?
     ORDER BY created_at ASC
     LIMIT 10`
  ).bind(now).all();
  const jobs = result.results || [];
  const fallbackOrigin = guessPublicOrigin(env);
  const siteData = await getSiteData(env);
  for (const job of jobs) {
    const text = String(job.tweetText || "").trim();
    if (!text) {
      await env.DB.prepare(
        `UPDATE x_posts SET status = ?, error_message = ? WHERE id = ?`
      ).bind("failed", "tweet text is empty", job.id).run();
      continue;
    }
    try {
      const live = findLiveById(siteData, job.liveId);
      let mediaIds = [];
      try {
        mediaIds = await getFlyerMediaIds(env, live, fallbackOrigin);
      } catch (e) {
        console.warn("flyer media skipped:", e);
        mediaIds = [];
      }
      const tweet = await postTweetToX(env, text, { mediaIds });
      await env.DB.prepare(
        `UPDATE x_posts
         SET status = ?, tweet_id = ?, tweet_url = ?, error_message = ?
         WHERE id = ?`
      ).bind("success", tweet.tweetId || "", tweet.url || "", "", job.id).run();
    } catch (error) {
      await env.DB.prepare(
        `UPDATE x_posts
         SET status = ?, error_message = ?
         WHERE id = ?`
      ).bind("failed", error.message || "failed", job.id).run();
    }
  }
  return { ok: true, processed: jobs.length, now };
}

function buildTicketLineMessage(reservation) {
  const r = reservation && typeof reservation === "object" ? reservation : {};
  const live = `${String(r.liveDate || "").trim()} ${String(r.liveVenue || "").trim()}`.trim();
  const lines = ["[ticket] 予約が届きました"];
  if (live) lines.push(live);
  if (r.name) lines.push(`名前: ${String(r.name).trim()}`);
  if (r.quantity) lines.push(`枚数: ${String(r.quantity).trim()}`);
  const msg = String(r.message || "").trim();
  if (msg) lines.push(`備考: ${msg.slice(0, 140)}`);
  if (r.id) lines.push(`id: ${String(r.id).trim()}`);
  return lines.join("\n");
}

async function sendLinePush(env, text) {
  const token = String(env.LINE_CHANNEL_ACCESS_TOKEN || "").trim();
  const to = String(env.LINE_TO || "").trim();
  if (!token || !to) return { skipped: true, reason: "not configured" };

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      messages: [{ type: "text", text }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LINE push failed: ${res.status} ${body}`.trim());
  }
  return { ok: true };
}

async function sendLineWebhook(env, payload) {
  const url = String(env.LINE_WEBHOOK_URL || "").trim();
  if (!url) return { skipped: true, reason: "not configured" };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LINE webhook failed: ${res.status} ${body}`.trim());
  }
  return { ok: true };
}

async function notifyTicketReservation(env, reservation) {
  const text = buildTicketLineMessage(reservation);
  const results = [];
  try {
    results.push(await sendLinePush(env, text));
  } catch (e) {
    console.error("LINE push error:", e);
  }
  try {
    results.push(await sendLineWebhook(env, { text, reservation }));
  } catch (e) {
    console.error("LINE webhook error:", e);
  }
  return results;
}

function buildTicketAutoReplyText(reservation) {
  const r = reservation && typeof reservation === "object" ? reservation : {};
  const live = `${String(r.liveDate || "").trim()} ${String(r.liveVenue || "").trim()}`.trim();
  const message = String(r.message || "").trim() || "なし";
  const lines = [
    "ticket予約を受け付けました。",
    "",
    `受付ID: ${String(r.id || "").trim()}`,
    `ライブ: ${live}`,
    `名前: ${String(r.name || "").trim()}`,
    `e-mail: ${String(r.email || "").trim()}`,
    `枚数: ${String(r.quantity || "").trim()}`,
    `備考: ${message}`,
    "",
    "このメールは受付内容の自動返信です。",
  ];
  return lines.join("\n");
}

function buildTicketAutoReplyFormData(reservation) {
  const r = reservation && typeof reservation === "object" ? reservation : {};
  const live = `${String(r.liveDate || "").trim()} ${String(r.liveVenue || "").trim()}`.trim();
  const body = buildTicketAutoReplyText(r);
  const formData = new FormData();
  formData.set("_replyto", String(r.email || "").trim());
  formData.set("_subject", `ticket予約受付: ${String(r.name || "").trim()}`);
  formData.set("email", String(r.email || "").trim());
  formData.set("name", String(r.name || "").trim());
  formData.set("receipt_id", String(r.id || "").trim());
  formData.set("live", live);
  formData.set("quantity", String(r.quantity || "").trim());
  formData.set("message", String(r.message || "").trim());
  formData.set("body", body);
  return formData;
}

async function sendTicketAutoReply(env, reservation) {
  const url = String(env.TICKET_AUTOREPLY_FORM_URL || "").trim();
  if (!url) return { skipped: true, reason: "not configured" };

  const res = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: buildTicketAutoReplyFormData(reservation),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ticket auto-reply failed: ${res.status} ${body}`.trim());
  }
  return { ok: true };
}

async function notifyTicketAutoReply(env, reservation) {
  try {
    return await sendTicketAutoReply(env, reservation);
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

async function handleRequest(request, env, ctx) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: createCorsHeaders(request, env),
    });
  }

  const url = new URL(request.url);
  const path = url.pathname;

  const imageMatch = path.match(/^\/images\/(.+)$/);
  if (imageMatch && (request.method === "GET" || request.method === "HEAD")) {
    return serveImage(request, env, decodeURIComponent(imageMatch[1]));
  }

  const ogLiveMatch = path.match(/^\/og\/live\/([^/]+)$/);
  if (ogLiveMatch && (request.method === "GET" || request.method === "HEAD")) {
    const liveId = decodeURIComponent(ogLiveMatch[1]);
    const siteData = await getSiteData(env);
    const live = findLiveById(siteData, liveId);
    if (!live) {
      return htmlResponse("not found", 404, { "Cache-Control": "no-store" });
    }

    const publicOrigin = guessPublicOrigin(env) || "https://1212hp.com";
    const canonicalUrl = `${String(publicOrigin).replace(/\/+$/, "")}/live/detail/?liveId=${encodeURIComponent(liveId)}`;
    const liveTitle = String(live?.title || "").trim();
    const heading = `${String(live?.date || "").trim()} ${String(live?.venue || "").trim()}`.trim();
    const title = liveTitle
      ? `${liveTitle} | ${heading || "Live"} | 松本一樹`
      : (heading ? `${heading} | 松本一樹` : "松本一樹 | Live");

    const compact = buildCompactDescription(live?.description || "");
    const description = truncate(compact || heading || "Live info", 180);

    const imageUrl =
      resolveOgImageUrl(live?.image || "", url.origin, publicOrigin, env) ||
      resolveOgImageUrl(siteData?.site?.heroImage || "", url.origin, publicOrigin, env);

    const headers = {
      "Cache-Control": "public, max-age=300",
    };

    if (request.method === "HEAD") {
      return htmlResponse("", 200, headers);
    }

    const html = buildOgLiveHtml({
      pageUrl: canonicalUrl,
      canonicalUrl,
      title,
      description,
      imageUrl,
    });

    return htmlResponse(html, 200, headers);
  }

  if (path === "/api/public/site-data" && request.method === "GET") {
    const row = await getSiteDataRow(env);
    return jsonResponse(
      { data: projectPublicSiteData(row.data), meta: { updatedAt: row.updatedAt } },
      request,
      env,
    );
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
      let notifications = null;
      try {
        notifications = Promise.all([
          notifyTicketReservation(env, reservation),
          notifyTicketAutoReply(env, reservation),
        ]);
        if (ctx && typeof ctx.waitUntil === "function") {
          ctx.waitUntil(notifications);
        } else {
          notifications.catch(() => {});
        }
      } catch (notificationError) {
        console.error("ticket reservation notification scheduling error:", notificationError);
        if (notifications) notifications.catch(() => {});
      }
      return jsonResponse({ ok: true, reservation }, request, env, 201);
    } catch (error) {
      if (error instanceof PublicReservationError) {
        return jsonResponse({ error: error.message }, request, env, 400);
      }
      console.error("public ticket reservation error:", error);
      return jsonResponse({ error: "internal server error" }, request, env, 500);
    }
  }

  if (path === "/api/admin/live-source-intake" && request.method === "POST") {
    if (!isAdminAuthorized(request, env)) {
      return jsonResponse({ error: "unauthorized" }, request, env, 401);
    }
    const payload = await request.json().catch(() => null);
    const sourceText = typeof payload?.sourceText === "string" ? payload.sourceText.trim() : "";
    if (!sourceText || sourceText.length > LIVE_AI_SOURCE_MAX_LENGTH) {
      return jsonResponse({ error: "invalid sourceText" }, request, env, 400);
    }
    if (!String(env.OPENAI_API_KEY || "").trim()) {
      return jsonResponse({ error: "AI source intake is not configured" }, request, env, 503);
    }

    try {
      const draft = await requestLiveAiDraft(env, sourceText);
      return jsonResponse({ draft }, request, env);
    } catch (error) {
      if (error instanceof LiveAiTimeoutError) {
        return jsonResponse({ error: "AI source intake timed out" }, request, env, 504);
      }
      return jsonResponse({ error: "AI source intake failed" }, request, env, 502);
    }
  }

  if (path === "/api/admin/site-data" && request.method === "GET") {
    if (!isAdminAuthorized(request, env)) {
      return jsonResponse({ error: "unauthorized" }, request, env, 401);
    }
    const row = await getSiteDataRow(env);
    return jsonResponse({ data: row.data, meta: { updatedAt: row.updatedAt } }, request, env);
  }

  if (path === "/api/admin/site-data" && request.method === "PUT") {
    if (!isAdminAuthorized(request, env)) {
      return jsonResponse({ error: "unauthorized" }, request, env, 401);
    }
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return jsonResponse({ error: "invalid payload" }, request, env, 400);
    }
    try {
      const saved = await saveSiteData(env, payload.data ?? payload);
      return jsonResponse({ ok: true, data: saved }, request, env);
    } catch (error) {
      if (error instanceof SiteDataValidationError) {
        return jsonResponse({ error: error.message }, request, env, 400);
      }
      throw error;
    }
  }

  if (path === "/api/admin/x-posts" && request.method === "GET") {
    if (!isAdminAuthorized(request, env)) {
      return jsonResponse({ error: "unauthorized" }, request, env, 401);
    }
    const liveId = url.searchParams.get("liveId") || "";
    const limit = url.searchParams.get("limit") || "100";
    const posts = await listXPosts(env, { liveId, limit });
    return jsonResponse({ posts }, request, env);
  }

  const previewMatch = path.match(/^\/api\/admin\/live\/([^/]+)\/preview-x$/);
  if (previewMatch && request.method === "POST") {
    if (!isAdminAuthorized(request, env)) {
      return jsonResponse({ error: "unauthorized" }, request, env, 401);
    }
    const liveId = decodeURIComponent(previewMatch[1]);
    const siteData = await getSiteData(env);
    const live = findLiveById(siteData, liveId);
    if (!live) return jsonResponse({ error: "live not found" }, request, env, 404);
    const tweetText = buildTweetText(live, env);
    return jsonResponse({ ok: true, liveId, tweetText }, request, env);
  }

  const scheduleMatch = path.match(/^\/api\/admin\/live\/([^/]+)\/schedule-x$/);
  if (scheduleMatch && request.method === "POST") {
    if (!isAdminAuthorized(request, env)) {
      return jsonResponse({ error: "unauthorized" }, request, env, 401);
    }
    const liveId = decodeURIComponent(scheduleMatch[1]);
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return jsonResponse({ error: "invalid payload" }, request, env, 400);
    }
    const scheduledAt = payload.scheduledAt || payload.scheduled_at || "";
    if (!isValidIsoDate(scheduledAt)) {
      return jsonResponse({ error: "scheduledAt is invalid" }, request, env, 400);
    }
    const scheduledAtIso = toIso(scheduledAt);
    const now = Date.now();
    if (new Date(scheduledAtIso).getTime() < now + 30 * 1000) {
      return jsonResponse({ error: "scheduledAt must be in the future" }, request, env, 400);
    }

    const siteData = await getSiteData(env);
    const live = findLiveById(siteData, liveId);
    if (!live) return jsonResponse({ error: "live not found" }, request, env, 404);

    const tweetTextInput = typeof payload.tweetText === "string" ? payload.tweetText.trim() : "";
    const tweetText = tweetTextInput || buildTweetText(live, env);
    if (!tweetText) return jsonResponse({ error: "tweetText is empty" }, request, env, 400);
    if (tweetText.length > 280) return jsonResponse({ error: "tweetText is too long" }, request, env, 400);

    const job = await createXPostSchedule(env, liveId, scheduledAtIso, tweetText);
    return jsonResponse({ ok: true, job }, request, env, 201);
  }

  const cancelMatch = path.match(/^\/api\/admin\/x-posts\/(\d+)\/cancel$/);
  if (cancelMatch && request.method === "POST") {
    if (!isAdminAuthorized(request, env)) {
      return jsonResponse({ error: "unauthorized" }, request, env, 401);
    }
    const id = Number(cancelMatch[1]);
    if (!Number.isFinite(id) || id <= 0) {
      return jsonResponse({ error: "invalid id" }, request, env, 400);
    }
    try {
      const updated = await cancelScheduledXPost(env, id);
      return jsonResponse({ ok: true, updated }, request, env);
    } catch (error) {
      if (error instanceof KnownClientError) {
        return jsonResponse({ error: error.message }, request, env, 400);
      }
      throw error;
    }
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

  if (path === "/api/admin/ticket-reservations" && request.method === "POST") {
    if (!isAdminAuthorized(request, env)) {
      return jsonResponse({ error: "unauthorized" }, request, env, 401);
    }
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return jsonResponse({ error: "invalid payload" }, request, env, 400);
    }
    try {
      const reservation = await createManualTicketReservation(env, payload);
      return jsonResponse({ ok: true, reservation }, request, env, 201);
    } catch (error) {
      if (error instanceof KnownClientError) {
        return jsonResponse({ error: error.message }, request, env, 400);
      }
      throw error;
    }
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
      if (error instanceof KnownClientError) {
        return jsonResponse({ error: error.message }, request, env, 400);
      }
      throw error;
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
    const payload = await request.json().catch(() => null);
    const dryRunParam = (url.searchParams.get("dryRun") || "").toLowerCase();
    const dryRun = dryRunParam === "1" || dryRunParam === "true" || dryRunParam === "yes";
    const liveId = decodeURIComponent(livePostMatch[1]);
    const siteData = await getSiteData(env);
    const live = findLiveById(siteData, liveId);
    if (!live) {
      return jsonResponse({ error: "live not found" }, request, env, 404);
    }

    const tweetTextInput = payload && typeof payload === "object" && typeof payload.tweetText === "string" ? payload.tweetText.trim() : "";
    const tweetText = tweetTextInput || buildTweetText(live, env);
    if (!tweetText) {
      return jsonResponse({ error: "tweetText is empty" }, request, env, 400);
    }
    if (tweetText.length > 280) {
      return jsonResponse({ error: "tweetText is too long" }, request, env, 400);
    }

    if (dryRun) {
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
    }

    try {
      let mediaIds = [];
      try {
        mediaIds = await getFlyerMediaIds(env, live, url.origin);
      } catch (e) {
        console.warn("flyer media skipped:", e);
        mediaIds = [];
      }
      const tweet = await postTweetToX(env, tweetText, { mediaIds });
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
      try {
        await recordPostLog(env, {
          liveId,
          status: "failed",
          tweetText,
          errorMessage: error.message,
        });
      } catch (logError) {
        console.error("x post failure log error:", logError);
      }
      throw error;
    }
  }

  return jsonResponse({ error: "not found" }, request, env, 404);
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env, ctx);
    } catch (error) {
      console.error("worker request error:", error);
      return jsonResponse(
        { error: "internal server error" },
        request,
        env,
        500
      );
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(executeDueXPostSchedules(env));
  },
};

export {
  buildTicketAutoReplyFormData,
  buildTicketAutoReplyText,
  notifyTicketAutoReply,
  sendTicketAutoReply,
};
