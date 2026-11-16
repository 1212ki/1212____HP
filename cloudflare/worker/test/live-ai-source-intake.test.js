import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { getEventListeners } from "node:events";

import worker from "../src/worker.js";

const ADMIN_TOKEN = "test-admin-token";
const OPENAI_KEY = "test-openai-key";
const CLAUDE_KEY = "test-anthropic-key";
const DRAFT_KEYS = [
  "date",
  "title",
  "venue",
  "openTime",
  "startTime",
  "ticket",
  "notes",
  "performers",
  "ticketUrl",
  "link",
];
const VALID_DRAFT = {
  date: "2026-08-20",
  title: "1212 Live",
  venue: "下北沢Example",
  openTime: "18:30",
  startTime: "19:00",
  ticket: "前売 ¥2,500 + 1D",
  notes: "再入場不可\n受付は18:00から",
  performers: "共演者A",
  ticketUrl: "https://tickets.example/events/1212",
  link: "https://example.com/events/1212",
};

function adminEnv(extra = {}) {
  return {
    ADMIN_SHARED_TOKEN: ADMIN_TOKEN,
    OPENAI_API_KEY: OPENAI_KEY,
    ...extra,
  };
}

function sourceIntakeRequest(body, { authenticated = true, raw = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authenticated) headers.Authorization = `Bearer ${ADMIN_TOKEN}`;
  return new Request("https://worker.test/api/admin/live-source-intake", {
    method: "POST",
    headers,
    body: raw ? body : JSON.stringify(body),
  });
}

function openAiPayload(outputText, { nested = false, status = "completed" } = {}) {
  return {
    id: "resp_test_1212",
    object: "response",
    created_at: 1_786_000_000,
    status,
    background: false,
    billing: { payer: "developer" },
    completed_at: status === "completed" ? 1_786_000_001 : null,
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: null,
    max_tool_calls: null,
    model: "gpt-5-mini",
    output: nested
      ? [{
          id: "msg_test_1212",
          type: "message",
          status: "completed",
          role: "assistant",
          content: [{
            type: "output_text",
            annotations: [],
            logprobs: [],
            text: outputText,
          }],
        }]
      : [],
    parallel_tool_calls: true,
    previous_response_id: null,
    prompt_cache_key: null,
    reasoning: { effort: null, summary: null },
    safety_identifier: null,
    service_tier: "default",
    store: true,
    temperature: 1,
    text: { format: { type: "json_schema" }, verbosity: "medium" },
    tool_choice: "auto",
    tools: [],
    top_logprobs: 0,
    top_p: 1,
    truncation: "disabled",
    usage: {
      input_tokens: 10,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: 10,
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: 20,
    },
    user: null,
    metadata: {},
    ...(nested ? {} : { output_text: outputText }),
  };
}

function openAiJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function withFetchStub(stub, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = stub;
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function overlongHttpUrl(length = 2_049) {
  const prefix = "https://example.com/";
  return `${prefix}${"a".repeat(length - prefix.length)}`;
}

function invalidDraftFixtures() {
  return [
    { name: "missing required key", value: { ...VALID_DRAFT, link: undefined } },
    { name: "extra key", value: { ...VALID_DRAFT, confidence: "high" } },
    { name: "non-object", value: [] },
    { name: "null", value: null },
    { name: "wrong field type", value: { ...VALID_DRAFT, venue: 1212 } },
    { name: "wrong date format", value: { ...VALID_DRAFT, date: "2026.08.20" } },
    { name: "impossible calendar date", value: { ...VALID_DRAFT, date: "2026-02-30" } },
    { name: "non-leap February 29", value: { ...VALID_DRAFT, date: "2026-02-29" } },
    { name: "invalid open time", value: { ...VALID_DRAFT, openTime: "24:00" } },
    { name: "invalid start time", value: { ...VALID_DRAFT, startTime: "19:60" } },
    { name: "long title", value: { ...VALID_DRAFT, title: "t".repeat(301) } },
    { name: "long venue", value: { ...VALID_DRAFT, venue: "v".repeat(301) } },
    { name: "long ticket", value: { ...VALID_DRAFT, ticket: "t".repeat(2_001) } },
    { name: "long notes", value: { ...VALID_DRAFT, notes: "n".repeat(10_001) } },
    { name: "long performers", value: { ...VALID_DRAFT, performers: "p".repeat(10_001) } },
    { name: "unsafe ticket URL", value: { ...VALID_DRAFT, ticketUrl: "javascript:alert(1)" } },
    { name: "ticket URL credentials", value: { ...VALID_DRAFT, ticketUrl: "https://user@example.com/ticket" } },
    { name: "link credentials", value: { ...VALID_DRAFT, link: "https://user:pass@example.com/live" } },
    { name: "long ticket URL", value: { ...VALID_DRAFT, ticketUrl: overlongHttpUrl() } },
    { name: "long link URL", value: { ...VALID_DRAFT, link: overlongHttpUrl() } },
  ];
}

function claudePayload(draft = VALID_DRAFT) {
  return {
    id: "msg_private_request_id",
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content: [
      { type: "thinking", thinking: "private thinking", signature: "private signature" },
      { type: "text", text: JSON.stringify(draft) },
    ],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 50, output_tokens: 100 },
  };
}

function providerFailures(provider) {
  const success = () => provider === "openai"
    ? openAiPayload(JSON.stringify(VALID_DRAFT)) : claudePayload();
  const failures = [400, 401, 403, 429, 500, 503].map((status) => ({
    name: `HTTP ${status}`,
    response: () => openAiJsonResponse({ error: { message: "private provider error" } }, status),
  }));
  failures.push(
    { name: "network throw", response: () => { throw new Error("private provider error"); } },
    { name: "invalid provider JSON", response: () => new Response("not-json") },
    ...[null, [], "invalid"].map((value) => ({ name: `envelope ${JSON.stringify(value)}`, response: () => openAiJsonResponse(value) })),
    { name: "error envelope", response: () => openAiJsonResponse({ ...success(), error: { message: "private provider error" } }) },
  );
  if (provider === "openai") {
    const refusal = openAiPayload("", { nested: true });
    refusal.output[0].content = [{ type: "refusal", refusal: "private refusal" }];
    failures.push(
      { name: "refusal", response: () => openAiJsonResponse(refusal) },
      { name: "top-level refusal", response: () => openAiJsonResponse({ ...success(), refusal: "private refusal" }) },
      { name: "incomplete", response: () => openAiJsonResponse(openAiPayload(JSON.stringify(VALID_DRAFT), { status: "incomplete" })) },
      ...[undefined, "", "{not-json"].map((value) => ({ name: `output ${String(value)}`, response: () => openAiJsonResponse(openAiPayload(value)) })),
    );
  } else {
    failures.push(
      ...["refusal", "max_tokens", "tool_use", null, undefined].map((reason) => ({
        name: `stop ${String(reason)}`, response: () => openAiJsonResponse({ ...success(), stop_reason: reason }),
      })),
      ...[undefined, null, {}, [], [{ type: "thinking", thinking: "private thinking" }], [{ type: "text", text: 5 }], [{ type: "text", text: "" }], [{ type: "text", text: "{not-json" }]].map((content) => ({
        name: `content ${JSON.stringify(content)}`, response: () => openAiJsonResponse({ ...success(), content }),
      })),
    );
  }
  return failures.concat(invalidDraftFixtures().map(({ name, value }) => ({
    name: `draft ${name}`,
    response: () => openAiJsonResponse(provider === "openai" ? openAiPayload(JSON.stringify(value)) : claudePayload(value)),
  })));
}

async function flushIntake() {
  for (let i = 0; i < 40; i += 1) await Promise.resolve();
}

function deferredIntake() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function observeIntake(env) {
  const state = { settled: false, response: null };
  state.promise = worker.fetch(sourceIntakeRequest({ sourceText: "公演情報" }), env, {}).then((response) => {
    state.settled = true;
    state.response = response;
    return response;
  });
  return state;
}

async function withIntakeClock(t, callback) {
  let now = 0;
  const activeTimers = new Map();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(performance, "now", () => now);
  const timerSet = globalThis.setTimeout;
  const timerClear = globalThis.clearTimeout;
  t.mock.method(globalThis, "setTimeout", (fn, delay) => {
    const handle = timerSet(() => { activeTimers.delete(handle); fn(); }, delay);
    activeTimers.set(handle, now + delay);
    return handle;
  });
  t.mock.method(globalThis, "clearTimeout", (handle) => {
    activeTimers.delete(handle);
    timerClear(handle);
  });
  const clock = {
    activeTimers,
    jump(ms) { now += ms; }, // Synchronous work delays timer delivery, while monotonic time advances.
    async advance(ms) { now += ms; t.mock.timers.tick(ms); await flushIntake(); },
  };
  try {
    await callback(clock);
    assert.equal(activeTimers.size, 0, "all attempt/global timers must be cleared on completion");
  } finally {
    t.mock.restoreAll();
    t.mock.timers.reset();
  }
}

describe("admin Live AI source intake", { concurrency: false }, () => {
  test("rejects unauthenticated requests before calling OpenAI", async () => {
    const originalFetch = globalThis.fetch;
    let outboundCalls = 0;
    globalThis.fetch = async () => {
      outboundCalls += 1;
      throw new Error("OpenAI must not be called");
    };

    try {
      const response = await worker.fetch(
        sourceIntakeRequest({ sourceText: "2026/08/20 公演情報" }, { authenticated: false }),
        adminEnv({ ANTHROPIC_API_KEY: CLAUDE_KEY }),
        {},
      );

      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "unauthorized" });
      assert.equal(outboundCalls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("rejects invalid sourceText before calling OpenAI", async () => {
    const originalFetch = globalThis.fetch;
    let outboundCalls = 0;
    globalThis.fetch = async () => {
      outboundCalls += 1;
      throw new Error("OpenAI must not be called");
    };

    const invalidRequests = [
      sourceIntakeRequest({}, {}),
      sourceIntakeRequest({ sourceText: null }),
      sourceIntakeRequest({ sourceText: 1212 }),
      sourceIntakeRequest({ sourceText: "" }),
      sourceIntakeRequest({ sourceText: " \n\t " }),
      sourceIntakeRequest({ sourceText: "x".repeat(12_001) }),
      sourceIntakeRequest("{", { raw: true }),
    ];

    try {
      for (const request of invalidRequests) {
        const response = await worker.fetch(request, adminEnv({ ANTHROPIC_API_KEY: CLAUDE_KEY }), {});
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: "invalid sourceText" });
      }
      assert.equal(outboundCalls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("returns 503 without calling OpenAI when OPENAI_API_KEY is missing", async () => {
    await withFetchStub(
      async () => assert.fail("OpenAI must not be called without configuration"),
      async () => {
        const response = await worker.fetch(
          sourceIntakeRequest({ sourceText: "2026/08/20 公演情報" }),
          adminEnv({ OPENAI_API_KEY: "" }),
          {},
        );

        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: "AI source intake is not configured" });
      },
    );
  });

  test("calls Responses API with the strict extraction contract and returns a normalized draft", async () => {
    let outbound = null;
    const providerDraft = {
      date: " 2026-08-20 ",
      title: " 1212 Live ",
      venue: " 下北沢Example ",
      openTime: " 18:30 ",
      startTime: " 19:00 ",
      ticket: " 前売 ¥2,500 + 1D ",
      notes: " 再入場不可\n受付は18:00から ",
      performers: " 共演者A ",
      ticketUrl: " https://tickets.example/events/1212 ",
      link: " https://example.com/events/1212 ",
    };

    await withFetchStub(
      async (url, options) => {
        outbound = { url: String(url), options };
        return openAiJsonResponse(openAiPayload(JSON.stringify(providerDraft)));
      },
      async () => {
        const response = await worker.fetch(
          sourceIntakeRequest({ sourceText: "  2026/08/20 下北沢 公演情報\n出演：松本一樹 / 共演者A  " }),
          adminEnv(),
          {},
        );

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { draft: VALID_DRAFT, provider: "openai" });
      },
    );

    assert.ok(outbound);
    assert.equal(outbound.url, "https://api.openai.com/v1/responses");
    assert.equal(outbound.options.method, "POST");
    const headers = new Headers(outbound.options.headers);
    assert.equal(headers.get("Authorization"), `Bearer ${OPENAI_KEY}`);
    assert.equal(headers.get("Content-Type"), "application/json");
    assert.ok(outbound.options.signal instanceof AbortSignal);

    const body = JSON.parse(outbound.options.body);
    assert.equal(body.model, "gpt-5-mini");
    assert.equal(body.input, "2026/08/20 下北沢 公演情報\n出演：松本一樹 / 共演者A");
    assert.equal(body.text.format.type, "json_schema");
    assert.equal(body.text.format.strict, true);
    assert.equal(body.text.format.schema.type, "object");
    assert.equal(body.text.format.schema.additionalProperties, false);
    assert.deepEqual(body.text.format.schema.required, DRAFT_KEYS);
    assert.deepEqual(Object.keys(body.text.format.schema.properties), DRAFT_KEYS);
    for (const key of DRAFT_KEYS) {
      assert.deepEqual(body.text.format.schema.properties[key], { type: "string" });
    }
    assert.match(body.instructions, /原文にない情報.*補わ/);
    assert.match(body.instructions, /YYYY-MM-DD/);
    assert.match(body.instructions, /openTime.*startTime.*HH:mm/s);
    assert.match(body.instructions, /notes.*※.*含め/s);
    assert.match(body.instructions, /performers.*\/.*w\./s);
    assert.match(body.instructions, /performers.*松本一樹.*1212.*除外.*共演者/s);
    assert.match(body.instructions, /ticketUrl.*予約.*購入/s);
    assert.match(body.instructions, /link.*公演詳細.*SNS/s);
    assert.doesNotMatch(body.instructions, /description/);
  });

  test("maps the real announcement format to draft fields in extraction instructions", async () => {
    let requestBody = null;
    const sourceText = [
      "「真夏の夜」",
      "2026.8.20(木) 柴崎mod",
      "OPEN 18:30 / START 19:00",
      "ADV ¥2,500 / DOOR ¥3,000",
      "-act-",
      "共演者A",
      "松本一樹",
    ].join("\n");

    await withFetchStub(
      async (_url, options) => {
        requestBody = JSON.parse(options.body);
        return openAiJsonResponse(openAiPayload(JSON.stringify(VALID_DRAFT)));
      },
      async () => {
        const response = await worker.fetch(
          sourceIntakeRequest({ sourceText }),
          adminEnv(),
          {},
        );

        assert.equal(response.status, 200);
      },
    );

    assert.equal(requestBody.input, sourceText);
    assert.match(requestBody.instructions, /「公演名」.*title/s);
    assert.match(requestBody.instructions, /日付と会場が同じ行.*date.*venue/s);
    assert.match(requestBody.instructions, /OPEN.*openTime.*START.*startTime/s);
    assert.match(requestBody.instructions, /ADV.*DOOR.*ticket/s);
    assert.match(requestBody.instructions, /-act-.*下.*performers/s);
  });

  test("accepts the 12,000 character boundary, model override, and standard nested output text", async () => {
    let requestBody = null;
    await withFetchStub(
      async (_url, options) => {
        requestBody = JSON.parse(options.body);
        return openAiJsonResponse(openAiPayload(JSON.stringify(VALID_DRAFT), { nested: true }));
      },
      async () => {
        const response = await worker.fetch(
          sourceIntakeRequest({ sourceText: "x".repeat(12_000) }),
          adminEnv({ LIVE_AI_MODEL: "gpt-5-mini-custom" }),
          {},
        );

        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { draft: VALID_DRAFT, provider: "openai" });
      },
    );

    assert.equal(requestBody.model, "gpt-5-mini-custom");
    assert.equal(requestBody.input.length, 12_000);
  });

  test("returns a sanitized 502 for invalid draft objects", async () => {
    const invalidDrafts = [
      { name: "missing required key", value: { ...VALID_DRAFT, link: undefined } },
      { name: "extra key", value: { ...VALID_DRAFT, confidence: "high" } },
      { name: "non-object", value: [] },
      { name: "null", value: null },
      { name: "wrong field type", value: { ...VALID_DRAFT, venue: 1212 } },
      { name: "wrong date format", value: { ...VALID_DRAFT, date: "2026.08.20" } },
      { name: "impossible calendar date", value: { ...VALID_DRAFT, date: "2026-02-30" } },
      { name: "non-leap February 29", value: { ...VALID_DRAFT, date: "2026-02-29" } },
      { name: "invalid open time", value: { ...VALID_DRAFT, openTime: "24:00" } },
      { name: "invalid start time", value: { ...VALID_DRAFT, startTime: "19:60" } },
      { name: "long title", value: { ...VALID_DRAFT, title: "t".repeat(301) } },
      { name: "long venue", value: { ...VALID_DRAFT, venue: "v".repeat(301) } },
      { name: "long notes", value: { ...VALID_DRAFT, notes: "n".repeat(10_001) } },
      { name: "long performers", value: { ...VALID_DRAFT, performers: "p".repeat(10_001) } },
      { name: "unsafe ticket URL", value: { ...VALID_DRAFT, ticketUrl: "javascript:alert(1)" } },
      { name: "ticket URL credentials", value: { ...VALID_DRAFT, ticketUrl: "https://user@example.com/ticket" } },
      { name: "link credentials", value: { ...VALID_DRAFT, link: "https://user:pass@example.com/live" } },
      { name: "long ticket URL", value: { ...VALID_DRAFT, ticketUrl: overlongHttpUrl() } },
      { name: "long link URL", value: { ...VALID_DRAFT, link: overlongHttpUrl() } },
    ];

    for (const invalid of invalidDrafts) {
      await withFetchStub(
        async () => openAiJsonResponse(openAiPayload(JSON.stringify(invalid.value))),
        async () => {
          const response = await worker.fetch(
            sourceIntakeRequest({ sourceText: `fixture: ${invalid.name}` }),
            adminEnv(),
            {},
          );

          assert.equal(response.status, 502, invalid.name);
          assert.deepEqual(
            await response.json(),
            { error: "AI source intake failed" },
            invalid.name,
          );
        },
      );
    }
  });

  test("returns a sanitized 502 for refusal, missing output, invalid JSON, and incomplete responses", async () => {
    const refusal = openAiPayload("", { nested: true });
    refusal.output[0].content = [{ type: "refusal", refusal: "provider refusal detail" }];
    const providerError = openAiPayload(JSON.stringify(VALID_DRAFT));
    providerError.error = { code: "provider_error", message: `secret ${OPENAI_KEY}` };

    const invalidProviderResponses = [
      { name: "refusal", response: () => openAiJsonResponse(refusal) },
      { name: "empty output", response: () => openAiJsonResponse(openAiPayload("")) },
      { name: "missing output", response: () => openAiJsonResponse(openAiPayload(undefined)) },
      { name: "invalid output JSON", response: () => openAiJsonResponse(openAiPayload("{not-json")) },
      { name: "invalid provider JSON", response: () => new Response("not-json", { status: 200 }) },
      {
        name: "incomplete response",
        response: () => openAiJsonResponse(openAiPayload(JSON.stringify(VALID_DRAFT), { status: "incomplete" })),
      },
      { name: "provider error object", response: () => openAiJsonResponse(providerError) },
    ];

    for (const invalid of invalidProviderResponses) {
      await withFetchStub(
        async () => invalid.response(),
        async () => {
          const response = await worker.fetch(
            sourceIntakeRequest({ sourceText: `fixture: ${invalid.name}` }),
            adminEnv(),
            {},
          );
          const rawBody = await response.text();

          assert.equal(response.status, 502, invalid.name);
          assert.deepEqual(JSON.parse(rawBody), { error: "AI source intake failed" }, invalid.name);
          assert.doesNotMatch(rawBody, new RegExp(OPENAI_KEY));
        },
      );
    }
  });

  test("hides provider body and API key when Responses API returns non-2xx", async () => {
    const providerBody = {
      error: {
        code: "rate_limit_exceeded",
        message: `provider detail containing ${OPENAI_KEY}`,
      },
    };

    await withFetchStub(
      async () => openAiJsonResponse(providerBody, 429),
      async () => {
        const response = await worker.fetch(
          sourceIntakeRequest({ sourceText: "公演情報" }),
          adminEnv(),
          {},
        );
        const rawBody = await response.text();

        assert.equal(response.status, 502);
        assert.deepEqual(JSON.parse(rawBody), { error: "AI source intake failed" });
        assert.doesNotMatch(rawBody, /rate_limit_exceeded|provider detail|test-openai-key/);
      },
    );
  });

  test("returns a sanitized 502 when the provider request fails", async () => {
    await withFetchStub(
      async () => {
        throw new Error(`network failed with ${OPENAI_KEY}`);
      },
      async () => {
        const response = await worker.fetch(
          sourceIntakeRequest({ sourceText: "公演情報" }),
          adminEnv(),
          {},
        );
        const rawBody = await response.text();

        assert.equal(response.status, 502);
        assert.deepEqual(JSON.parse(rawBody), { error: "AI source intake failed" });
        assert.doesNotMatch(rawBody, /network failed|test-openai-key/);
      },
    );
  });

  test("aborts Responses API after 15 seconds and returns a sanitized 504", async (t) => {
    await withIntakeClock(t, async (clock) => {
      let signal;
      await withFetchStub(async (_url, options) => {
        signal = options.signal;
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException(`aborted ${OPENAI_KEY}`, "AbortError")), { once: true });
        });
      }, async () => {
        const state = observeIntake(adminEnv());
        await flushIntake();
        await clock.advance(14_999);
        assert.equal(state.settled, false);
        assert.equal(signal.aborted, false);
        await clock.advance(1);
        assert.equal(state.settled, true);
        assert.equal(signal.aborted, true);
        assert.equal(state.response.status, 504);
        assert.deepEqual(await state.response.json(), { error: "AI source intake timed out" });
        assert.equal(getEventListeners(signal, "abort").length, 0);
      });
    });
  });
});

describe("provider fallback contract", { concurrency: false }, () => {
  const bothKeys = () => adminEnv({ ANTHROPIC_API_KEY: CLAUDE_KEY });

  test("key combinations skip unconfigured providers and prefer OpenAI without calling Claude", async (t) => {
    const cases = [
      ["both", bothKeys(), "openai"],
      ["OpenAI only", adminEnv(), "openai"],
      ["Claude only", adminEnv({ OPENAI_API_KEY: "", ANTHROPIC_API_KEY: CLAUDE_KEY }), "claude"],
      ["whitespace OpenAI", adminEnv({ OPENAI_API_KEY: " \n ", ANTHROPIC_API_KEY: CLAUDE_KEY }), "claude"],
      ["whitespace Claude", adminEnv({ ANTHROPIC_API_KEY: " \t " }), "openai"],
      ["neither", adminEnv({ OPENAI_API_KEY: undefined }), null],
      ["empty", adminEnv({ OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "" }), null],
      ["whitespace both", adminEnv({ OPENAI_API_KEY: " \n ", ANTHROPIC_API_KEY: " \t " }), null],
    ];
    for (const [name, env, provider] of cases) await t.test(name, async () => {
      const calls = [];
      await withFetchStub(async (url) => {
        calls.push(String(url));
        return openAiJsonResponse(String(url).includes("anthropic") ? claudePayload() : openAiPayload(JSON.stringify(VALID_DRAFT)));
      }, async () => {
        const response = await worker.fetch(sourceIntakeRequest({ sourceText: "公演情報" }), env, {});
        assert.equal(response.status, provider ? 200 : 503);
        assert.deepEqual(await response.json(), provider ? { draft: VALID_DRAFT, provider } : { error: "AI source intake is not configured" });
        assert.deepEqual(calls, provider ? [provider === "openai" ? "https://api.openai.com/v1/responses" : "https://api.anthropic.com/v1/messages"] : []);
      });
    });
  });

  test("every OpenAI failure falls back once to Claude with the same source and retries OpenAI on the next request", async (t) => {
    for (const failure of providerFailures("openai")) await t.test(failure.name, async () => {
      const calls = [];
      await withFetchStub(async (url, options) => {
        calls.push({ url: String(url), body: JSON.parse(options.body) });
        return String(url).includes("openai") ? failure.response() : openAiJsonResponse(claudePayload());
      }, async () => {
        for (let request = 0; request < 2; request += 1) {
          const response = await worker.fetch(sourceIntakeRequest({ sourceText: "  確定した元情報\n公演  " }), bothKeys(), {});
          assert.equal(response.status, 200);
          assert.deepEqual(await response.json(), { draft: VALID_DRAFT, provider: "claude" });
        }
      });
      assert.deepEqual(calls.map((call) => call.url), ["https://api.openai.com/v1/responses", "https://api.anthropic.com/v1/messages", "https://api.openai.com/v1/responses", "https://api.anthropic.com/v1/messages"]);
      for (let index = 0; index < calls.length; index += 2) {
        assert.equal(calls[index].body.input, "確定した元情報\n公演");
        assert.deepEqual(calls[index + 1].body.messages, [{ role: "user", content: calls[index].body.input }]);
      }
    });
  });

  test("Claude wire contract shares instructions and schema, reads text blocks, and uses only supported fields", async (t) => {
    for (const model of [undefined, " \t ", " custom-claude-model "]) await t.test(`model ${String(model)}`, async () => {
      const calls = [];
      await withFetchStub(async (url, options) => {
        calls.push({ url: String(url), options, body: JSON.parse(options.body) });
        if (String(url).includes("openai")) return openAiJsonResponse({}, 429);
        const text = JSON.stringify(Object.fromEntries(Object.entries(VALID_DRAFT).map(([key, value]) => [key, ` ${value} `])));
        return openAiJsonResponse({ ...claudePayload(), content: [
          { type: "thinking", thinking: "private thinking" },
          { type: "text", text: text.slice(0, 20) },
          { type: "thinking", thinking: "another private thought" },
          { type: "text", text: text.slice(20) },
        ] });
      }, async () => {
        const response = await worker.fetch(sourceIntakeRequest({ sourceText: "x".repeat(12_000) }), { ...bothKeys(), LIVE_AI_CLAUDE_MODEL: model, LIVE_AI_MODEL: "openai-custom" }, {});
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { draft: VALID_DRAFT, provider: "claude" });
      });
      assert.equal(calls.length, 2);
      const [openai, claude] = calls;
      assert.equal(claude.url, "https://api.anthropic.com/v1/messages");
      assert.equal(claude.options.method, "POST");
      assert.deepEqual(Object.fromEntries(new Headers(claude.options.headers)), { "anthropic-version": "2023-06-01", "content-type": "application/json", "x-api-key": CLAUDE_KEY });
      assert.ok(claude.options.signal instanceof AbortSignal);
      assert.deepEqual(Object.keys(claude.body).sort(), ["max_tokens", "messages", "model", "output_config", "system"]);
      assert.equal(claude.body.model, model?.trim() || "claude-haiku-5-5");
      assert.equal(openai.body.model, "openai-custom");
      assert.equal(claude.body.max_tokens, 16_384);
      assert.equal(claude.body.system, openai.body.instructions);
      assert.deepEqual(claude.body.messages, [{ role: "user", content: openai.body.input }]);
      assert.deepEqual(claude.body.output_config, { effort: "low", format: { type: "json_schema", schema: openai.body.text.format.schema } });
    });
  });

  test("every Claude failure returns a sanitized 502 for single and dual providers", async (t) => {
    for (const failure of providerFailures("claude")) for (const dual of [false, true]) await t.test(`${failure.name} / ${dual ? "dual" : "single"}`, async () => {
      const calls = [];
      await withFetchStub(async (url) => {
        calls.push(String(url));
        return String(url).includes("openai") ? openAiJsonResponse({}, 503) : failure.response();
      }, async () => {
        const response = await worker.fetch(sourceIntakeRequest({ sourceText: "公演情報" }), { ...bothKeys(), OPENAI_API_KEY: dual ? OPENAI_KEY : "" }, {});
        assert.equal(response.status, 502);
        assert.deepEqual(await response.json(), { error: "AI source intake failed" });
        assert.equal(calls.length, dual ? 2 : 1);
      });
    });
  });

  test("success and failure responses and logs omit secrets, provider errors, request IDs and prompt sentinels", async (t) => {
    for (const outcome of ["openai", "claude", "failure"]) await t.test(outcome, async () => {
      const sentinel = `private-provider-detail ${OPENAI_KEY} ${CLAUDE_KEY} req_private_123 prompt_private`;
      const logs = [];
      const errorSpy = t.mock.method(console, "error", (...args) => logs.push(args));
      const logSpy = t.mock.method(console, "log", (...args) => logs.push(args));
      const sentBodies = [];
      await withFetchStub(async (url, options) => {
        sentBodies.push(JSON.parse(options.body));
        const provider = String(url).includes("openai") ? "openai" : "claude";
        const payload = provider === "openai" ? openAiPayload(JSON.stringify(VALID_DRAFT)) : claudePayload();
        payload.id = sentinel;
        if (outcome !== provider) payload.error = { message: sentinel };
        return new Response(JSON.stringify(payload), { headers: { "request-id": sentinel } });
      }, async () => {
        const response = await worker.fetch(sourceIntakeRequest({ sourceText: "prompt_private" }), bothKeys(), {});
        const body = await response.text();
        assert.equal(response.status, outcome === "failure" ? 502 : 200);
        assert.deepEqual(JSON.parse(body), outcome === "failure" ? { error: "AI source intake failed" } : { draft: VALID_DRAFT, provider: outcome });
        for (const privateValue of [OPENAI_KEY, CLAUDE_KEY, "private-provider-detail", "req_private_123", "prompt_private", sentBodies[0].instructions]) assert.equal(body.includes(privateValue), false);
        assert.deepEqual(logs, []);
      });
      errorSpy.mock.restore();
      logSpy.mock.restore();
    });
  });
});

describe("provider deadlines with a monotonic fake clock", { concurrency: false }, () => {
  const bothKeys = () => adminEnv({ ANTHROPIC_API_KEY: CLAUDE_KEY });

  for (const provider of ["openai", "claude"]) test(`${provider} alone aborts an uncooperative fetch at 15000ms`, async (t) => {
    await withIntakeClock(t, async (clock) => {
      const signals = [];
      await withFetchStub(async (_url, options) => { signals.push(options.signal); return new Promise(() => {}); }, async () => {
        const env = provider === "openai" ? adminEnv() : { ...bothKeys(), OPENAI_API_KEY: "" };
        const state = observeIntake(env);
        await flushIntake();
        assert.equal(state.settled, false);
        await clock.advance(14_999);
        assert.equal(state.settled, false);
        await clock.advance(1);
        assert.equal(state.settled, true);
        assert.equal(state.response.status, 504);
        assert.deepEqual(await state.response.json(), { error: "AI source intake timed out" });
        assert.equal(signals.length, 1);
        assert.equal(signals[0].aborted, true);
        assert.equal(getEventListeners(signals[0], "abort").length, 0);
      });
    });
  });

  for (const final of ["success", "HTTP failure", "timeout"]) test(`OpenAI 15s timeout then Claude ${final} respects the 30s deadline and final error classification`, async (t) => {
    await withIntakeClock(t, async (clock) => {
      const calls = [];
      const openai = deferredIntake();
      const claude = deferredIntake();
      await withFetchStub(async (url, options) => {
        calls.push({ url: String(url), signal: options.signal });
        return calls.length === 1 ? openai.promise : claude.promise;
      }, async () => {
        const state = observeIntake(bothKeys());
        await flushIntake();
        await clock.advance(15_000);
        assert.equal(calls.length, 2);
        assert.equal(calls[0].signal.aborted, true);
        assert.equal(calls[1].signal.aborted, false);
        assert.equal(state.settled, false);
        if (final === "timeout") {
          await clock.advance(14_999);
          assert.equal(state.settled, false);
          await clock.advance(1);
        } else {
          await clock.advance(1_000);
          claude.resolve(openAiJsonResponse(final === "success" ? claudePayload() : {}, final === "success" ? 200 : 503));
          await flushIntake();
        }
        assert.equal(state.settled, true);
        assert.equal(state.response.status, final === "success" ? 200 : final === "timeout" ? 504 : 502);
        assert.deepEqual(await state.response.clone().json(), final === "success" ? { draft: VALID_DRAFT, provider: "claude" } : { error: final === "timeout" ? "AI source intake timed out" : "AI source intake failed" });
        if (final === "timeout") assert.equal(calls[1].signal.aborted, true);
        openai.resolve(openAiJsonResponse(openAiPayload(JSON.stringify({ ...VALID_DRAFT, title: "late OpenAI" }))));
        claude.reject(new Error("late private provider rejection"));
        await flushIntake();
        await clock.advance(60_000);
        assert.equal(calls.length, 2);
        for (const call of calls) assert.equal(getEventListeners(call.signal, "abort").length, 0);
        if (final === "success") assert.equal((await state.response.json()).draft.title, VALID_DRAFT.title);
      });
    });
  });

  test("immediate OpenAI failure gives Claude at most 15s rather than waiting for the global timer", async (t) => {
    await withIntakeClock(t, async (clock) => {
      const calls = [];
      await withFetchStub(async (url, options) => {
        calls.push(options.signal);
        return String(url).includes("openai") ? openAiJsonResponse({}, 401) : new Promise(() => {});
      }, async () => {
        const state = observeIntake(bothKeys());
        await flushIntake();
        assert.equal(calls.length, 2);
        await clock.advance(14_999);
        assert.equal(state.settled, false);
        await clock.advance(1);
        assert.equal(state.settled, true);
        assert.equal(state.response.status, 504);
        assert.equal(calls[1].aborted, true);
      });
    });
  });

  for (const dual of [false, true]) test(`response body stalls inside the attempt deadline / ${dual ? "fallback" : "single"}`, async (t) => {
    await withIntakeClock(t, async (clock) => {
      let bodyRead = false;
      const signals = [];
      await withFetchStub(async (_url, options) => {
        signals.push(options.signal);
        return signals.length === 1 ? { ok: true, json() { bodyRead = true; return new Promise(() => {}); } } : openAiJsonResponse(claudePayload());
      }, async () => {
        const state = observeIntake(dual ? bothKeys() : adminEnv());
        await flushIntake();
        assert.equal(bodyRead, true);
        await clock.advance(15_000);
        assert.equal(state.settled, true);
        assert.equal(state.response.status, dual ? 200 : 504);
        if (dual) assert.deepEqual(await state.response.json(), { draft: VALID_DRAFT, provider: "claude" });
        assert.equal(signals[0].aborted, true);
        assert.equal(signals.length, dual ? 2 : 1);
      });
    });
  });

  test("synchronous processing consumes the overall budget and caps Claude at the 10s remainder", async (t) => {
    await withIntakeClock(t, async (clock) => {
      const signals = [];
      await withFetchStub(async (_url, options) => {
        signals.push(options.signal);
        if (signals.length === 1) return { ok: true, async json() { clock.jump(20_000); return {}; } };
        return new Promise(() => {});
      }, async () => {
        const state = observeIntake(bothKeys());
        await flushIntake();
        assert.equal(signals.length, 2);
        assert.equal(signals[0].aborted, true);
        assert.ok([...clock.activeTimers.values()].includes(30_000), "Claude deadline must be the original overall deadline");
        await clock.advance(9_999);
        assert.equal(state.settled, false);
        await clock.advance(1);
        assert.equal(state.settled, true);
        assert.equal(state.response.status, 504);
        assert.equal(signals[1].aborted, true);
      });
    });
  });

  test("no Claude call begins after synchronous work exhausts the global deadline", async (t) => {
    await withIntakeClock(t, async (clock) => {
      const signals = [];
      await withFetchStub(async (_url, options) => {
        signals.push(options.signal);
        return { ok: true, async json() { clock.jump(30_000); return {}; } };
      }, async () => {
        const state = observeIntake(bothKeys());
        await flushIntake();
        assert.equal(state.settled, true);
        assert.equal(state.response.status, 504);
        assert.equal(signals.length, 1);
        assert.equal(signals[0].aborted, true);
      });
    });
  });

  for (const provider of ["openai", "claude"]) for (const ms of [14_999, 15_000, 15_001]) test(`${provider} success at ${ms}ms is accepted only before the attempt deadline even with delayed timers`, async (t) => {
    await withIntakeClock(t, async (clock) => {
      let signal;
      await withFetchStub(async (_url, options) => {
        signal = options.signal;
        return { ok: true, async json() { clock.jump(ms); return provider === "openai" ? openAiPayload(JSON.stringify(VALID_DRAFT)) : claudePayload(); } };
      }, async () => {
        const state = observeIntake(provider === "openai" ? adminEnv() : { ...bothKeys(), OPENAI_API_KEY: "" });
        await flushIntake();
        assert.equal(state.settled, true);
        assert.equal(state.response.status, ms < 15_000 ? 200 : 504);
        if (ms >= 15_000) assert.equal(signal.aborted, true);
      });
    });
  });

  for (const provider of ["openai", "claude"]) test(`${provider} validation finishing at the deadline is discarded`, async (t) => {
    await withIntakeClock(t, async (clock) => {
      const draftText = JSON.stringify(VALID_DRAFT);
      const parse = JSON.parse;
      t.mock.method(JSON, "parse", (text, ...args) => {
        const result = parse(text, ...args);
        if (text === draftText) {
          let firstRead = true;
          Object.defineProperty(result, "title", { enumerable: true, get() {
            if (firstRead) { clock.jump(15_000); firstRead = false; }
            return VALID_DRAFT.title;
          } });
        }
        return result;
      });
      let signal;
      await withFetchStub(async (_url, options) => {
        signal = options.signal;
        return { ok: true, async json() { return provider === "openai" ? openAiPayload(draftText) : claudePayload(); } };
      }, async () => {
        const state = observeIntake(provider === "openai" ? adminEnv() : { ...bothKeys(), OPENAI_API_KEY: "" });
        await flushIntake();
        assert.equal(state.settled, true);
        assert.equal(state.response.status, 504);
        assert.equal(signal.aborted, true);
      });
    });
  });

  for (const ms of [29_999, 30_000, 30_001]) test(`Claude success at global time ${ms}ms cannot reset the overall deadline`, async (t) => {
    await withIntakeClock(t, async (clock) => {
      const signals = [];
      await withFetchStub(async (_url, options) => {
        signals.push(options.signal);
        if (signals.length === 1) return new Promise(() => {});
        return { ok: true, async json() { clock.jump(ms - 15_000); return claudePayload(); } };
      }, async () => {
        const state = observeIntake(bothKeys());
        await flushIntake();
        await clock.advance(15_000);
        assert.equal(state.settled, true);
        assert.equal(signals.length, 2);
        assert.equal(state.response.status, ms < 30_000 ? 200 : 504);
        assert.equal(signals[0].aborted, true);
        if (ms >= 30_000) assert.equal(signals[1].aborted, true);
      });
    });
  });

  for (const status of [200, 502, 504]) test(`all timers and abort listeners are released after status ${status}`, async (t) => {
    await withIntakeClock(t, async (clock) => {
      const signals = [];
      const late = deferredIntake();
      await withFetchStub(async (_url, options) => {
        signals.push(options.signal);
        return status === 504 ? late.promise : openAiJsonResponse(status === 200 ? openAiPayload(JSON.stringify(VALID_DRAFT)) : {}, status === 200 ? 200 : 503);
      }, async () => {
        const state = observeIntake(adminEnv());
        await flushIntake();
        if (status === 504) await clock.advance(15_000);
        assert.equal(state.settled, true);
        assert.equal(state.response.status, status);
        assert.equal(clock.activeTimers.size, 0);
        if (status === 504) late.reject(new Error("late private error"));
        await flushIntake();
        await clock.advance(60_000);
        assert.equal(signals.length, 1);
        assert.equal(getEventListeners(signals[0], "abort").length, 0);
      });
    });
  });
});
