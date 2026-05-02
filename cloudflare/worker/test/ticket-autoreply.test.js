import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTicketAutoReplyFormData,
  buildTicketAutoReplyText,
  notifyTicketAutoReply,
  sendTicketAutoReply,
} from "../src/worker.js";

const reservation = {
  id: "ticket_20260502_abcd",
  liveDate: "2026-06-01",
  liveVenue: "下北沢Example",
  name: "山田 太郎",
  email: "taro@example.com",
  quantity: 2,
  message: "友人と行きます",
};

test("buildTicketAutoReplyText includes reservation details", () => {
  const text = buildTicketAutoReplyText(reservation);

  assert.match(text, /予約を受け付けました/);
  assert.match(text, /受付ID: ticket_20260502_abcd/);
  assert.match(text, /ライブ: 2026-06-01 下北沢Example/);
  assert.match(text, /名前: 山田 太郎/);
  assert.match(text, /e-mail: taro@example.com/);
  assert.match(text, /枚数: 2/);
  assert.match(text, /備考: 友人と行きます/);
});

test("buildTicketAutoReplyFormData creates Formspree-compatible payload", () => {
  const formData = buildTicketAutoReplyFormData(reservation);
  const entries = Object.fromEntries(formData.entries());

  assert.equal(entries._replyto, "taro@example.com");
  assert.equal(entries.email, "taro@example.com");
  assert.equal(entries.name, "山田 太郎");
  assert.equal(entries.receipt_id, "ticket_20260502_abcd");
  assert.equal(entries.live, "2026-06-01 下北沢Example");
  assert.equal(entries.quantity, "2");
  assert.equal(entries.message, "友人と行きます");
  assert.match(entries.body, /受付ID: ticket_20260502_abcd/);
});

test("sendTicketAutoReply skips when endpoint is not configured", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("ok");
  };

  try {
    const result = await sendTicketAutoReply({}, reservation);
    assert.deepEqual(result, { skipped: true, reason: "not configured" });
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sendTicketAutoReply posts the payload to the configured endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let request = null;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    const result = await sendTicketAutoReply(
      { TICKET_AUTOREPLY_FORM_URL: "https://formspree.io/f/ticket" },
      reservation
    );
    const entries = Object.fromEntries(request.options.body.entries());

    assert.deepEqual(result, { ok: true });
    assert.equal(request.url, "https://formspree.io/f/ticket");
    assert.equal(request.options.method, "POST");
    assert.equal(request.options.headers.Accept, "application/json");
    assert.equal(entries.email, "taro@example.com");
    assert.match(entries.body, /ライブ: 2026-06-01 下北沢Example/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("notifyTicketAutoReply catches send failures", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("bad request", { status: 400 });

  try {
    const result = await notifyTicketAutoReply(
      { TICKET_AUTOREPLY_FORM_URL: "https://formspree.io/f/ticket" },
      reservation
    );
    assert.equal(result.ok, false);
    assert.match(result.error, /ticket auto-reply failed: 400/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
