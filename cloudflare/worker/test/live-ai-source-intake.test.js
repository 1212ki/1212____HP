import assert from "node:assert/strict";
import test, { describe } from "node:test";

import worker from "../src/worker.js";

const ADMIN_TOKEN = "test-admin-token";
const OPENAI_KEY = "test-openai-key";
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
        adminEnv(),
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
        const response = await worker.fetch(request, adminEnv(), {});
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
        assert.deepEqual(await response.json(), { draft: VALID_DRAFT });
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
        assert.deepEqual(await response.json(), { draft: VALID_DRAFT });
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

  test("aborts Responses API after 15 seconds and returns a sanitized 504", async () => {
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const fakeTimerHandle = { id: "live-ai-timeout" };
    let timeoutMs = null;
    let clearedHandle = null;

    globalThis.setTimeout = (callback, delay) => {
      timeoutMs = delay;
      queueMicrotask(callback);
      return fakeTimerHandle;
    };
    globalThis.clearTimeout = (handle) => {
      clearedHandle = handle;
    };

    try {
      await withFetchStub(
        async (_url, options) => new Promise((_resolve, reject) => {
          const rejectOnAbort = () => reject(new DOMException(`aborted ${OPENAI_KEY}`, "AbortError"));
          if (options.signal.aborted) {
            rejectOnAbort();
          } else {
            options.signal.addEventListener("abort", rejectOnAbort, { once: true });
          }
        }),
        async () => {
          const response = await worker.fetch(
            sourceIntakeRequest({ sourceText: "公演情報" }),
            adminEnv(),
            {},
          );
          const rawBody = await response.text();

          assert.equal(response.status, 504);
          assert.deepEqual(JSON.parse(rawBody), { error: "AI source intake timed out" });
          assert.doesNotMatch(rawBody, /aborted|test-openai-key/);
        },
      );
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    }

    assert.equal(timeoutMs, 15_000);
    assert.equal(clearedHandle, fakeTimerHandle);
  });
});
