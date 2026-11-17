import assert from "node:assert/strict";
import test from "node:test";
import * as worker from "../src/worker.js";

const reservation = {
  id: " ticket_test ", liveDate: " 2099-06-01 ", liveVenue: " 架空Hall ",
  name: " 山田 太郎 ", email: " taro@example.com ", quantity: 2,
  message: " 日本語 &+\n二行目 ",
};
const env = { TICKET_AUTOREPLY_FORM_URL: " https://script.example/exec ", TICKET_AUTOREPLY_TOKEN: " test-token " };
const expected = { token: " test-token ", receipt_id: "ticket_test", live: "2099-06-01 架空Hall", name: "山田 太郎", email: "taro@example.com", quantity: "2", message: "日本語 &+\n二行目" };
async function withFetch(stub, run) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  try { await run(); } finally { globalThis.fetch = original; }
}
test("payload has exactly seven form-encoded keys and round-trips trimmed special text", () => {
  assert.equal(typeof worker.buildTicketAutoReplyPayload, "function");
  const body = worker.buildTicketAutoReplyPayload(reservation, env.TICKET_AUTOREPLY_TOKEN);
  assert.ok(body instanceof URLSearchParams);
  assert.deepEqual(Object.fromEntries(new URLSearchParams(body.toString())), expected);
  assert.equal(worker.buildTicketAutoReplyPayload({ ...reservation, message: " " }, "x").get("message"), "");
  assert.equal("buildTicketAutoReplyFormData" in worker, false);
  assert.equal("buildTicketAutoReplyText" in worker, false);
});
test("send uses body-only token, form content type and default redirects", async () => {
  let calls = 0;
  await withFetch(async (url, options) => {
    calls += 1;
    assert.equal(url, "https://script.example/exec");
    assert.equal(new URL(url).search, "");
    assert.equal(options.method, "POST");
    assert.deepEqual(options.headers, { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" });
    assert.ok(options.body instanceof URLSearchParams);
    assert.deepEqual(Object.fromEntries(options.body), expected);
    assert.equal("redirect" in options, false);
    return Response.json({ ok: true });
  }, async () => assert.deepEqual(await worker.sendTicketAutoReply(env, reservation), { ok: true }));
  assert.equal(calls, 1);
});
for (const [label, config] of [
  ["neither", {}], ["URL missing", { TICKET_AUTOREPLY_TOKEN: "test" }],
  ["URL blank", { ...env, TICKET_AUTOREPLY_FORM_URL: " \t" }],
  ["token missing", { TICKET_AUTOREPLY_FORM_URL: env.TICKET_AUTOREPLY_FORM_URL }],
  ["token blank", { ...env, TICKET_AUTOREPLY_TOKEN: " \n" }],
]) {
  test(`unconfigured ${label} skips without fetch`, async () => {
    await withFetch(() => assert.fail("must skip"), async () => {
      assert.deepEqual(await worker.sendTicketAutoReply(config, reservation), { skipped: true, reason: "not configured" });
    });
  });
}
test("manual reservation skips even with both secrets", async () => {
  await withFetch(() => assert.fail("manual must not send"), async () => {
    assert.equal((await worker.sendTicketAutoReply(env, { ...reservation, source: "manual" })).skipped, true);
  });
});
for (const [label, stub] of [
  ["HTTP", () => new Response("private upstream body test-token", { status: 400 })],
  ["network", () => { throw new Error("private upstream URL test-token"); }],
  ["JSON", () => new Response("private HTML test-token")],
  ["false", () => Response.json({ ok: false, error: "private test-token" })],
  ["missing", () => Response.json({})], ["truthy", () => Response.json({ ok: "true" })],
  ["null", () => Response.json(null)],
]) {
  test(`${label} failure is sanitized in send and notify`, async () => {
    await withFetch(stub, async () => {
      await assert.rejects(worker.sendTicketAutoReply(env, reservation), (error) => {
        assert.match(error.message, /^ticket auto-reply failed(?:: 400)?$/);
        return true;
      });
      assert.deepEqual(await worker.notifyTicketAutoReply(env, reservation), { ok: false, error: "ticket auto-reply failed" });
    });
  });
}
