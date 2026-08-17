import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/worker.js";

function createEnv(live) {
  const siteData = {
    site: { heroImage: "" },
    live: { ticketLink: "", upcoming: [live], past: [] },
  };
  return {
    PUBLIC_ORIGIN: "https://1212hp.com",
    DB: {
      prepare() {
        return {
          bind() { return this; },
          async first() {
            return {
              data: JSON.stringify(siteData),
              updated_at: "2026-08-04T00:00:00.000Z",
            };
          },
          async run() { return { success: true }; },
        };
      },
    },
  };
}

test("Issue #29 Worker OGP route characterization keeps crawler metadata and human canonical fallback", async () => {
  const live = {
    id: "structured-og",
    date: "2026.9.28(日)",
    title: "Structured Live",
    venue: "<Hall>",
    openTime: "18:30",
    startTime: "19:00",
    ticket: "¥2,500 + 1D",
    notes: "再入場不可",
    performers: "A / B",
    image: "assets/images/live.jpg",
  };
  const canonicalUrl = "https://1212hp.com/live/detail/?liveId=structured-og";
  const escapedTitle = "Structured Live | 2026.09.28(Mon) &lt;Hall&gt; | 松本一樹";
  const description = "Open/Start: 18:30/19:00 / ticket: ¥2,500 + 1D / ※再入場不可 / w. A / B";
  const imageUrl = "https://1212hp.com/assets/images/live.jpg";
  const htmlByUserAgent = [];

  for (const userAgent of ["Twitterbot/1.0", "Mozilla/5.0"]) {
    const response = await worker.fetch(
      new Request("https://example.test/og/live/structured-og", {
        headers: { "User-Agent": userAgent },
      }),
      createEnv(live),
      {},
    );
    const html = await response.text();
    htmlByUserAgent.push(html);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "public, max-age=300");
    assert.equal(response.headers.has("location"), false);
    assert.ok(html.includes(`<meta property="og:title" content="${escapedTitle}" />`));
    assert.ok(html.includes(`<meta property="og:description" content="${description}" />`));
    assert.ok(html.includes(`<meta property="og:image" content="${imageUrl}" />`));
    assert.ok(html.includes(`<meta property="og:url" content="${canonicalUrl}" />`));
    assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image" />'));
    assert.ok(html.includes(`<meta name="twitter:title" content="${escapedTitle}" />`));
    assert.ok(html.includes(`<meta name="twitter:description" content="${description}" />`));
    assert.ok(html.includes(`<meta name="twitter:image" content="${imageUrl}" />`));
    assert.ok(html.includes(`<link rel="canonical" href="${canonicalUrl}" />`));
    assert.ok(html.includes(`<a class="btn" href="${canonicalUrl}" rel="noopener">詳細を見る</a>`));
    assert.ok(html.includes(`location.replace(${JSON.stringify(canonicalUrl)})`));
  }

  assert.equal(htmlByUserAgent[0], htmlByUserAgent[1]);

  const missingResponse = await worker.fetch(
    new Request("https://example.test/og/live/missing-live"),
    createEnv(live),
    {},
  );
  assert.equal(missingResponse.status, 404);
  assert.equal(missingResponse.headers.get("cache-control"), "no-store");
});

test("OG Live metadata uses the structured date and details contract", async () => {
  const live = {
    id: "structured-og",
    date: "2026.9.28(日)",
    title: "Structured Live",
    venue: "<Hall>",
    openTime: "18:30",
    startTime: "19:00",
    ticket: "¥2,500 + 1D",
    notes: "再入場不可",
    performers: "A / B",
    description: "legacy must not render",
  };
  const response = await worker.fetch(
    new Request("https://worker.test/og/live/structured-og"),
    createEnv(live),
    {},
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /Structured Live \| 2026\.09\.28\(Mon\) &lt;Hall&gt; \| 松本一樹/);
  assert.match(html, /Open\/Start: 18:30\/19:00 \/ ticket: ¥2,500 \+ 1D \/ ※再入場不可 \/ w\. A \/ B/);
  assert.doesNotMatch(html, /legacy must not render/);
});

test("OG Live metadata keeps legacy description fallback", async () => {
  const live = {
    id: "legacy-og",
    date: "2026/09/28",
    title: "Legacy Live",
    venue: "Hall",
    description: "OPEN 18:30 / START 19:00\n出演：旧データ",
  };
  const response = await worker.fetch(
    new Request("https://worker.test/og/live/legacy-og"),
    createEnv(live),
    {},
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /2026\.09\.28\(Mon\) Hall/);
  assert.match(html, /OPEN 18:30 \/ START 19:00 \/ 出演：旧データ/);
});
