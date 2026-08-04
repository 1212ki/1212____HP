import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test, { describe } from "node:test";

import worker from "../src/worker.js";

const internalLive = {
  id: "live_internal",
  date: "2099-08-09",
  venue: "Internal Hall",
  ticketUrl: "",
};

function makeSiteData(live = { upcoming: [internalLive], past: [] }) {
  return { live: { ticketLink: "", upcoming: live.upcoming || [], past: live.past || [] } };
}

function createD1Stub({
  siteData = makeSiteData(),
  recentReservationId = null,
  siteDataReadError = null,
  writeError = null,
  writeErrorPattern = null,
} = {}) {
  const calls = [];
  const DB = {
    prepare(sql) {
      const call = { sql: String(sql), bindings: [], operation: "prepare" };
      calls.push(call);
      const statement = {
        bind(...bindings) {
          call.bindings = bindings;
          return statement;
        },
        async first() {
          call.operation = "first";
          if (/FROM site_data/i.test(call.sql)) {
            if (siteDataReadError) throw siteDataReadError;
            return {
              data: JSON.stringify(siteData),
              updated_at: "2026-07-31T00:00:00.000Z",
            };
          }
          if (/SELECT id FROM ticket_reservations/i.test(call.sql)) {
            return recentReservationId ? { id: recentReservationId } : null;
          }
          return null;
        },
        async all() {
          call.operation = "all";
          return { results: [] };
        },
        async run() {
          call.operation = "run";
          if (writeError && (!writeErrorPattern || writeErrorPattern.test(call.sql))) throw writeError;
          const changes = recentReservationId && /INSERT INTO ticket_reservations/i.test(call.sql) ? 0 : 1;
          return { success: true, meta: { changes } };
        },
      };
      return statement;
    },
  };
  return { DB, calls };
}

function createConcurrentD1Stub() {
  const calls = [];
  const rows = [];
  let arrivals = 0;
  let releaseBarrier;
  const barrier = new Promise((resolve) => { releaseBarrier = resolve; });

  async function synchronizeReservationAttempt() {
    arrivals += 1;
    if (arrivals === 2) releaseBarrier();
    await barrier;
  }

  const DB = {
    prepare(sql) {
      const call = { sql: String(sql), bindings: [], operation: "prepare" };
      calls.push(call);
      const statement = {
        bind(...bindings) {
          call.bindings = bindings;
          return statement;
        },
        async first() {
          call.operation = "first";
          if (/FROM site_data/i.test(call.sql)) {
            return {
              data: JSON.stringify(makeSiteData()),
              updated_at: "2026-07-31T00:00:00.000Z",
            };
          }
          if (/SELECT id FROM ticket_reservations/i.test(call.sql)) {
            await synchronizeReservationAttempt();
            return null;
          }
          return null;
        },
        async all() {
          call.operation = "all";
          return { results: [] };
        },
        async run() {
          call.operation = "run";
          if (!/INSERT INTO ticket_reservations/i.test(call.sql)) {
            return { success: true, meta: { changes: 1 } };
          }

          const conditional = /WHERE\s+NOT\s+EXISTS/i.test(call.sql);
          if (conditional) await synchronizeReservationAttempt();
          const liveId = String(call.bindings[1]);
          const email = String(call.bindings[5]);
          const createdAt = String(call.bindings[9]);
          const threshold = conditional ? String(call.bindings.at(-1)) : "";
          const duplicate = conditional && rows.some((row) => (
            row.liveId === liveId && row.email === email && row.createdAt >= threshold
          ));
          if (duplicate) return { success: true, meta: { changes: 0 } };
          rows.push({ id: call.bindings[0], liveId, email, createdAt });
          return { success: true, meta: { changes: 1 } };
        },
      };
      return statement;
    },
  };
  return { DB, calls, rows };
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function interpolateSql(sql, bindings) {
  let index = 0;
  const bound = String(sql).replace(/\?/g, () => sqlLiteral(bindings[index++]));
  assert.equal(index, bindings.length, "all D1 bindings must be consumed by the SQLite probe");
  return bound;
}

function runSqliteProbe(sql) {
  const result = spawnSync("sqlite3", [":memory:"], { input: sql, encoding: "utf8" });
  if (result.error?.code === "ENOENT") return null;
  assert.equal(result.status, 0, result.stderr || "sqlite3 probe failed");
  return result.stdout.trim().split(/\s+/);
}

function jsonRequest(path, body, { method = "POST", authenticated = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authenticated) headers.Authorization = "Bearer test-admin-token";
  return new Request(`https://worker.test${path}`, {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

function envFor(db, extra = {}) {
  return { DB: db, ADMIN_SHARED_TOKEN: "test-admin-token", ...extra };
}

function publicReservationRequest(liveId = "live_internal") {
  return jsonRequest("/api/public/ticket-reservations", {
    liveId,
    name: "Web Guest",
    email: "web@example.com",
    quantity: 1,
  });
}

function hasSqlCall(calls, pattern) {
  return calls.some((call) => pattern.test(call.sql));
}

async function withUtcHostClock(iso, callback) {
  const RealDate = globalThis.Date;
  const fixedNow = RealDate.parse(iso);
  class UtcHostDate extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [fixedNow]));
    }
    static now() { return fixedNow; }
    getFullYear() { return this.getUTCFullYear(); }
    getMonth() { return this.getUTCMonth(); }
    getDate() { return this.getUTCDate(); }
  }
  globalThis.Date = UtcHostDate;
  try {
    return await callback();
  } finally {
    globalThis.Date = RealDate;
  }
}

function duplicateData(kind) {
  if (kind === "cross-collection") {
    return makeSiteData({
      upcoming: [{ id: "duplicate-live", date: "2099-08-01", venue: "Upcoming Hall", ticketUrl: "" }],
      past: [{ id: "duplicate-live", date: "2000-08-01", venue: "Past Hall", ticketUrl: "" }],
    });
  }
  return makeSiteData({
    upcoming: [
      { id: "duplicate-live", date: "2099-08-01", venue: "First Hall", ticketUrl: "" },
      { id: "duplicate-live", date: "2099-08-02", venue: "Second Hall", ticketUrl: "" },
    ],
    past: [],
  });
}

describe("public ticket boundary hardening", () => {
  test("public site-data omits Live management fields while admin retains stored values", async () => {
    const siteData = makeSiteData({
      upcoming: [{
        ...internalLive,
        sourceText: "upcoming private source",
        xComment: "upcoming unpublished comment",
      }],
      past: [{
        id: "live_past",
        date: "2000-08-09",
        venue: "Past Hall",
        sourceText: "past private source",
        xComment: "past unpublished comment",
      }],
    });
    const d1 = createD1Stub({ siteData });

    const publicResponse = await worker.fetch(
      new Request("https://worker.test/api/public/site-data"),
      envFor(d1.DB),
      {},
    );
    const adminResponse = await worker.fetch(
      new Request("https://worker.test/api/admin/site-data", {
        headers: { Authorization: "Bearer test-admin-token" },
      }),
      envFor(d1.DB),
      {},
    );
    const publicData = (await publicResponse.json()).data;
    const adminData = (await adminResponse.json()).data;

    assert.equal(publicResponse.status, 200);
    assert.equal(adminResponse.status, 200);
    for (const collection of ["upcoming", "past"]) {
      assert.equal("sourceText" in publicData.live[collection][0], false);
      assert.equal("xComment" in publicData.live[collection][0], false);
      assert.equal(adminData.live[collection][0].sourceText, `${collection} private source`);
      assert.equal(adminData.live[collection][0].xComment, `${collection} unpublished comment`);
    }
    assert.equal(siteData.live.upcoming[0].sourceText, "upcoming private source");
    assert.equal(siteData.live.past[0].xComment, "past unpublished comment");
    assert.equal(hasSqlCall(d1.calls, /INSERT OR REPLACE INTO site_data/i), false);
  });

  test("public reservation rejects non-integer raw quantities before insert and notification scheduling", async (t) => {
    const invalidCases = [
      ["missing", undefined],
      ["blank", ""],
      ["numeric string", "2"],
      ["fractional", 1.5],
      ["NaN-like", "NaN"],
      ["null", null],
      ["zero", 0],
      ["above range", 11],
    ];

    for (const [label, quantity] of invalidCases) {
      await t.test(label, async () => {
        const d1 = createD1Stub();
        const scheduled = [];
        const response = await worker.fetch(
          jsonRequest("/api/public/ticket-reservations", {
            liveId: "live_internal",
            name: "Invalid Quantity Guest",
            email: `${label.replace(/\s+/g, "-")}@example.com`,
            quantity,
          }),
          envFor(d1.DB),
          { waitUntil(promise) { scheduled.push(promise); } },
        );

        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: "quantity is invalid" });
        assert.equal(hasSqlCall(d1.calls, /INSERT INTO ticket_reservations/i), false);
        assert.equal(scheduled.length, 0);
      });
    }
  });

  test("public reservation accepts an integer quantity and inserts and schedules once", async () => {
    const d1 = createD1Stub();
    const scheduled = [];
    const response = await worker.fetch(
      publicReservationRequest(),
      envFor(d1.DB),
      { waitUntil(promise) { scheduled.push(promise); } },
    );
    await Promise.all(scheduled);

    assert.equal(response.status, 201);
    const inserts = d1.calls.filter((call) => /INSERT INTO ticket_reservations/i.test(call.sql));
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0].bindings[6], 1);
    assert.equal(scheduled.length, 1);
  });

  test("public reservation changes business date exactly at Asia/Tokyo midnight on a UTC-like Worker host", async (t) => {
    const data = makeSiteData({
      upcoming: [{ id: "tokyo-boundary", date: "2026-08-01", venue: "Boundary Hall", ticketUrl: "" }],
      past: [],
    });
    const cases = [
      ["immediately before midnight", "2026-08-01T14:59:59.999Z", 201, true],
      ["at midnight", "2026-08-01T15:00:00.000Z", 400, false],
    ];

    for (const [label, now, expectedStatus, shouldInsert] of cases) {
      await t.test(label, async () => {
        await withUtcHostClock(now, async () => {
          const d1 = createD1Stub({ siteData: data });
          const scheduled = [];
          const response = await worker.fetch(
            publicReservationRequest("tokyo-boundary"),
            envFor(d1.DB),
            { waitUntil(promise) { scheduled.push(promise); } },
          );
          await Promise.all(scheduled);

          assert.equal(response.status, expectedStatus);
          assert.equal(hasSqlCall(d1.calls, /INSERT INTO ticket_reservations/i), shouldInsert);
          if (!shouldInsert) {
            assert.equal(hasSqlCall(d1.calls, /SELECT id FROM ticket_reservations/i), false);
          }
        });
      });
    }
  });

  test("duplicate Live IDs fail closed for public and manual reservation routes", async (t) => {
    for (const kind of ["cross-collection", "same-collection"]) {
      await t.test(`${kind} public`, async () => {
        const d1 = createD1Stub({ siteData: duplicateData(kind) });
        const scheduled = [];
        const response = await worker.fetch(
          publicReservationRequest("duplicate-live"),
          envFor(d1.DB),
          { waitUntil(promise) { scheduled.push(promise); } },
        );
        await Promise.all(scheduled);

        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: "live ID is ambiguous" });
        assert.equal(hasSqlCall(d1.calls, /SELECT id FROM ticket_reservations/i), false);
        assert.equal(hasSqlCall(d1.calls, /INSERT INTO ticket_reservations/i), false);
      });

      await t.test(`${kind} manual`, async () => {
        const d1 = createD1Stub({ siteData: duplicateData(kind) });
        const response = await worker.fetch(
          jsonRequest(
            "/api/admin/ticket-reservations",
            { liveId: "duplicate-live", name: "Manual Guest", quantity: 1 },
            { authenticated: true },
          ),
          envFor(d1.DB),
          {},
        );

        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: "live ID is ambiguous" });
        assert.equal(hasSqlCall(d1.calls, /INSERT INTO ticket_reservations/i), false);
      });
    }
  });

  test("legacy ambiguous site data remains readable and is never rewritten by public reads", async (t) => {
    for (const kind of ["cross-collection", "same-collection"]) {
      await t.test(kind, async () => {
        const d1 = createD1Stub({ siteData: duplicateData(kind) });
        const response = await worker.fetch(
          new Request("https://worker.test/api/public/site-data"),
          envFor(d1.DB),
          {},
        );
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.data.live.upcoming.filter((live) => live.id === "duplicate-live").length, kind === "same-collection" ? 2 : 1);
        assert.equal(hasSqlCall(d1.calls, /INSERT OR REPLACE INTO site_data/i), false);
      });
    }
  });

  test("admin site-data PUT rejects duplicate Live IDs before writing D1", async (t) => {
    for (const kind of ["cross-collection", "same-collection"]) {
      await t.test(kind, async () => {
        const data = duplicateData(kind);
        const d1 = createD1Stub();
        const response = await worker.fetch(
          jsonRequest("/api/admin/site-data", data, { method: "PUT", authenticated: true }),
          envFor(d1.DB),
          {},
        );

        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), { error: "duplicate Live ID: duplicate-live" });
        assert.equal(hasSqlCall(d1.calls, /INSERT OR REPLACE INTO site_data/i), false);
      });
    }
  });

  test("known recent-duplicate error remains a specific safe 400", async () => {
    const d1 = createD1Stub({ recentReservationId: "ticket_existing" });
    const response = await worker.fetch(publicReservationRequest(), envFor(d1.DB), {});

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "reservation already submitted recently" });
    assert.equal(hasSqlCall(d1.calls, /SELECT id FROM ticket_reservations/i), false);
    const insert = d1.calls.find((call) => /INSERT INTO ticket_reservations/i.test(call.sql));
    assert.ok(insert);
    assert.match(insert.sql, /INSERT[\s\S]+SELECT[\s\S]+WHERE\s+NOT\s+EXISTS/i);
  });

  test("five-minute duplicate guard uses one UTC format with real SQLite conditional-insert semantics", async (t) => {
    let insert;
    await withUtcHostClock("2026-08-01T12:00:00.000Z", async () => {
      const d1 = createD1Stub();
      const response = await worker.fetch(publicReservationRequest(), envFor(d1.DB), {});
      assert.equal(response.status, 201);
      insert = d1.calls.find((call) => /INSERT INTO ticket_reservations/i.test(call.sql));
    });

    assert.ok(insert);
    assert.match(insert.sql, /INSERT[\s\S]+SELECT[\s\S]+WHERE\s+NOT\s+EXISTS/i);
    assert.match(insert.sql, /created_at\s*>=\s*\?/i);
    assert.doesNotMatch(insert.sql, /datetime\s*\(/i);
    assert.equal(insert.bindings.at(-1), "2026-08-01T11:55:00.000Z");

    const table = `
      CREATE TABLE ticket_reservations (
        id TEXT PRIMARY KEY,
        live_id TEXT NOT NULL,
        live_date TEXT,
        live_venue TEXT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        message TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        source TEXT NOT NULL
      );`;
    const boundInsert = interpolateSql(insert.sql, insert.bindings);
    const probe = (existingCreatedAt) => runSqliteProbe(`${table}
      INSERT INTO ticket_reservations VALUES
        ('existing', 'live_internal', '', '', 'Existing', 'web@example.com', 1, '', 'pending',
         '${existingCreatedAt}', '${existingCreatedAt}', 'web');
      ${boundInsert};
      SELECT changes();
      SELECT COUNT(*) FROM ticket_reservations;`);

    const oldRow = probe("2026-08-01T00:00:00.000Z");
    if (oldRow === null) {
      t.skip("sqlite3 CLI is unavailable");
      return;
    }
    assert.deepEqual(oldRow, ["1", "2"]);
    assert.deepEqual(probe("2026-08-01T11:56:00.000Z"), ["0", "1"]);
  });

  test("concurrent duplicate requests atomically produce one insert and one known 400", async () => {
    const d1 = createConcurrentD1Stub();
    const scheduled = [];
    const responses = await Promise.all([
      worker.fetch(publicReservationRequest(), envFor(d1.DB), { waitUntil(promise) { scheduled.push(promise); } }),
      worker.fetch(publicReservationRequest(), envFor(d1.DB), { waitUntil(promise) { scheduled.push(promise); } }),
    ]);
    await Promise.all(scheduled);

    assert.deepEqual(responses.map((response) => response.status).sort((a, b) => a - b), [201, 400]);
    const bodies = await Promise.all(responses.map((response) => response.json()));
    assert.equal(bodies.filter((body) => body.ok === true).length, 1);
    assert.equal(
      bodies.filter((body) => body.error === "reservation already submitted recently").length,
      1,
    );
    assert.equal(d1.rows.length, 1);
    assert.equal(d1.calls.filter((call) => /INSERT INTO ticket_reservations/i.test(call.sql)).length, 2);
    assert.equal(hasSqlCall(d1.calls, /SELECT id FROM ticket_reservations/i), false);
    assert.equal(scheduled.length, 1);
  });

  test("top-level catch logs and redacts unexpected errors on public site-data and OG GET routes", async (t) => {
    const internalMessage = "D1_ERROR: no such column private_schema.secret_value";
    const routes = [
      "/api/public/site-data",
      "/og/live/live_internal",
    ];

    for (const route of routes) {
      await t.test(route, async () => {
        const d1 = createD1Stub({ siteDataReadError: new Error(internalMessage) });
        const logs = [];
        const originalConsoleError = console.error;
        console.error = (...args) => logs.push(args);
        let response;
        try {
          response = await worker.fetch(new Request(`https://worker.test${route}`), envFor(d1.DB), {});
        } finally {
          console.error = originalConsoleError;
        }

        assert.equal(response.status, 500);
        const body = await response.json();
        assert.deepEqual(body, { error: "internal server error" });
        assert.doesNotMatch(JSON.stringify(body), /private_schema|secret_value|D1_ERROR/i);
        assert.ok(logs.some((args) => args.some((value) => String(value).includes(internalMessage))));
      });
    }
  });

  test("known admin and ticket route errors remain specific and safe", async () => {
    const d1 = createD1Stub({ recentReservationId: "ticket_existing" });
    const [adminResponse, ticketResponse] = await Promise.all([
      worker.fetch(new Request("https://worker.test/api/admin/site-data"), envFor(d1.DB), {}),
      worker.fetch(publicReservationRequest(), envFor(d1.DB), {}),
    ]);

    assert.equal(adminResponse.status, 401);
    assert.deepEqual(await adminResponse.json(), { error: "unauthorized" });
    assert.equal(ticketResponse.status, 400);
    assert.deepEqual(await ticketResponse.json(), { error: "reservation already submitted recently" });
  });

  test("unexpected admin D1 errors bypass known-client handlers and use the logged generic 500", async (t) => {
    const internalMessage = "D1_ERROR: no such column private_schema.secret_value";
    const cases = [
      [
        "manual reservation insert",
        jsonRequest(
          "/api/admin/ticket-reservations",
          { liveId: "live_internal", name: "Manual Guest", quantity: 1 },
          { authenticated: true },
        ),
        /INSERT INTO ticket_reservations/i,
      ],
      [
        "ticket status update",
        jsonRequest(
          "/api/admin/ticket-reservations/ticket_1/status",
          { status: "handled" },
          { authenticated: true },
        ),
        /UPDATE ticket_reservations/i,
      ],
    ];

    for (const [label, request, writeErrorPattern] of cases) {
      await t.test(label, async () => {
        const d1 = createD1Stub({
          writeError: new Error(internalMessage),
          writeErrorPattern,
        });
        const logs = [];
        const originalConsoleError = console.error;
        console.error = (...args) => logs.push(args);
        let response;
        try {
          response = await worker.fetch(request, envFor(d1.DB), {});
        } finally {
          console.error = originalConsoleError;
        }

        assert.equal(response.status, 500);
        const body = await response.json();
        assert.deepEqual(body, { error: "internal server error" });
        assert.doesNotMatch(JSON.stringify(body), /private_schema|secret_value|D1_ERROR/i);
        assert.ok(logs.some((args) => args.some((value) => String(value).includes(internalMessage))));
      });
    }
  });

  test("unexpected X route errors reach the logged generic top-level 500", async (t) => {
    const internalMessage = "upstream private diagnostic: request signature internals";
    const routes = [
      "/api/admin/live/live_internal/post-x?dryRun=1",
      "/api/admin/live/live_internal/post-x",
    ];
    const originalFetch = globalThis.fetch;

    try {
      globalThis.fetch = async () => { throw new Error(internalMessage); };
      for (const route of routes) {
        await t.test(route, async () => {
          const d1 = createD1Stub();
          const logs = [];
          const originalConsoleError = console.error;
          console.error = (...args) => logs.push(args);
          let response;
          try {
            response = await worker.fetch(
              jsonRequest(route, {}, { authenticated: true }),
              envFor(d1.DB, {
                X_CONSUMER_KEY: "consumer-key",
                X_CONSUMER_SECRET: "consumer-secret",
                X_ACCESS_TOKEN: "access-token",
                X_ACCESS_TOKEN_SECRET: "access-token-secret",
              }),
              {},
            );
          } finally {
            console.error = originalConsoleError;
          }

          assert.equal(response.status, 500);
          const body = await response.json();
          assert.deepEqual(body, { error: "internal server error" });
          assert.doesNotMatch(JSON.stringify(body), /private diagnostic|signature internals/i);
          assert.ok(logs.some((args) => args.some((value) => String(value).includes(internalMessage))));
        });
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("unexpected D1 errors are logged and returned as a generic 500 without leakage", async () => {
    const internalMessage = "D1_ERROR: no such column private_schema.secret_value";
    const d1 = createD1Stub({ siteDataReadError: new Error(internalMessage) });
    const logs = [];
    const originalConsoleError = console.error;
    console.error = (...args) => logs.push(args);
    let response;
    try {
      response = await worker.fetch(publicReservationRequest(), envFor(d1.DB), {});
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal(response.status, 500);
    const body = await response.json();
    assert.deepEqual(body, { error: "internal server error" });
    assert.doesNotMatch(JSON.stringify(body), /private_schema|secret_value|D1_ERROR/i);
    assert.ok(logs.some((args) => args.some((value) => String(value).includes(internalMessage))));
  });

  test("post-insert notification and waitUntil scheduling failures still return 201 with one insert", async () => {
    const d1 = createD1Stub();
    const logs = [];
    const originalConsoleError = console.error;
    const originalFetch = globalThis.fetch;
    console.error = (...args) => logs.push(args);
    globalThis.fetch = async () => { throw new Error("notification transport failed"); };
    let response;
    try {
      response = await worker.fetch(
        publicReservationRequest(),
        envFor(d1.DB, {
          LINE_WEBHOOK_URL: "https://notify.example/webhook",
          TICKET_AUTOREPLY_FORM_URL: "https://forms.example/reply",
        }),
        { waitUntil() { throw new Error("waitUntil scheduling failed"); } },
      );
      await new Promise((resolve) => setImmediate(resolve));
    } finally {
      globalThis.fetch = originalFetch;
      console.error = originalConsoleError;
    }

    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.reservation.liveId, "live_internal");
    assert.equal(d1.calls.filter((call) => /INSERT INTO ticket_reservations/i.test(call.sql)).length, 1);
    assert.ok(logs.some((args) => args.some((value) => String(value).includes("waitUntil scheduling failed"))));
  });
});
