import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/worker.js";

const ADMIN_TOKEN = "test-admin-token";
const structuredLive = {
  id: "structured-x",
  date: "2026.9.28(日)",
  title: "Structured X Live",
  venue: "Example Hall",
  openTime: "18:30",
  startTime: "19:00",
  ticket: "¥2,500 + 1D",
  notes: "再入場不可",
  performers: "A / B",
  description: "legacy must not render",
  image: "",
};

function createEnv() {
  const siteData = {
    live: { ticketLink: "", upcoming: [structuredLive], past: [] },
  };
  return {
    ADMIN_SHARED_TOKEN: ADMIN_TOKEN,
    X_CONSUMER_KEY: "test-consumer-key",
    X_CONSUMER_SECRET: "test-consumer-secret",
    X_ACCESS_TOKEN: "test-access-token",
    X_ACCESS_TOKEN_SECRET: "test-access-token-secret",
    DB: {
      prepare(sql) {
        const statement = {
          bind() { return statement; },
          async first() {
            if (/FROM site_data/i.test(sql)) {
              return { data: JSON.stringify(siteData), updated_at: "2026-08-04T00:00:00.000Z" };
            }
            return null;
          },
          async run() { return { success: true, meta: { last_row_id: 1212, changes: 1 } }; },
        };
        return statement;
      },
    },
  };
}

function adminRequest(path, body) {
  return new Request(`https://worker.test${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ADMIN_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function assertStructuredTweet(text) {
  assert.match(text, /2026\.09\.28\(Mon\) Example Hall/);
  assert.match(text, /Open\/Start: 18:30\/19:00/);
  assert.match(text, /ticket: ¥2,500 \+ 1D/);
  assert.match(text, /※再入場不可/);
  assert.match(text, /w\. A \/ B/);
  assert.doesNotMatch(text, /legacy must not render/);
}

test("fallback X preview, schedule, and dry-run post preserve structured Live fields", { concurrency: false }, async () => {
  const env = createEnv();

  const preview = await worker.fetch(
    adminRequest("/api/admin/live/structured-x/preview-x"),
    env,
    {},
  );
  assert.equal(preview.status, 200);
  const previewPayload = await preview.json();
  assertStructuredTweet(previewPayload.tweetText);

  const schedule = await worker.fetch(
    adminRequest("/api/admin/live/structured-x/schedule-x", { scheduledAt: "2099-09-28T00:00:00.000Z" }),
    env,
    {},
  );
  assert.equal(schedule.status, 201);
  const schedulePayload = await schedule.json();
  assertStructuredTweet(schedulePayload.job.tweetText);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /^https:\/\/api\.x\.com\/1\.1\/account\/verify_credentials\.json/);
    return new Response(JSON.stringify({ id_str: "owner", screen_name: "1212", name: "Owner" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const post = await worker.fetch(
      adminRequest("/api/admin/live/structured-x/post-x?dryRun=1", {}),
      env,
      {},
    );
    assert.equal(post.status, 200);
    const postPayload = await post.json();
    assert.equal(postPayload.dryRun, true);
    assertStructuredTweet(postPayload.tweetText);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
