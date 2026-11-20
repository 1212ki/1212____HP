import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { describe } from "node:test";

import worker, { summarizeTicketReservationRows } from "../src/worker.js";

// T46-SUM (Issue #46): GET /api/admin/ticket-reservation-summary and its counting rule.
// The rows below are synthetic (test/fixtures/admin-live-states.json); no personal data is involved.

const fixture = JSON.parse(
  await readFile(new URL("../../../test/fixtures/admin-live-states.json", import.meta.url), "utf8")
);

const SUMMARY_PATH = "/api/admin/ticket-reservation-summary";
const PERSONAL_COLUMNS = ["name", "email", "message", "contact", "internal_note", "created_at", "updated_at", "live_date", "live_venue", "source"];

function createD1Stub({ rows = [] } = {}) {
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
          return null;
        },
        async all() {
          call.operation = "all";
          return { results: rows };
        },
        async run() {
          call.operation = "run";
          return { success: true, meta: { changes: 0 } };
        },
      };
      return statement;
    },
  };
  return { DB, calls };
}

function summaryRequest({ method = "GET", token = "test-admin-token", origin } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (origin) headers.Origin = origin;
  return new Request(`https://worker.test${SUMMARY_PATH}`, { method, headers });
}

const adminEnv = (DB, extra = {}) => ({ DB, ADMIN_SHARED_TOKEN: "test-admin-token", ...extra });
const normalizeSql = (sql) => String(sql).replace(/\s+/g, " ").trim();

describe("ticket reservation summary route", () => {
  test("a missing or wrong token is 401 and the DB is never prepared", async () => {
    for (const token of ["", "wrong-token"]) {
      const d1 = createD1Stub();
      const response = await worker.fetch(summaryRequest({ token }), adminEnv(d1.DB), {});
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "unauthorized" });
      assert.equal(d1.calls.length, 0, `no prepare for token "${token}"`);
    }
  });

  test("no admin token configured also stays 401 without reading the DB", async () => {
    const d1 = createD1Stub();
    const response = await worker.fetch(summaryRequest(), { DB: d1.DB }, {});
    assert.equal(response.status, 401);
    assert.equal(d1.calls.length, 0);
  });

  test("an authorized read runs one aggregate query and answers the summaries for the synthetic rows", async () => {
    const d1 = createD1Stub({ rows: fixture.summary.groupedRows });
    const response = await worker.fetch(summaryRequest(), adminEnv(d1.DB), {});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { summaries: fixture.summary.expected });
    assert.equal(d1.calls.length, 1, "one query only");
    assert.equal(d1.calls[0].operation, "all");
    assert.deepEqual(d1.calls[0].bindings, []);
  });

  test("the query groups by live and status and reads no personal column", async () => {
    const d1 = createD1Stub();
    await worker.fetch(summaryRequest(), adminEnv(d1.DB), {});
    const sql = normalizeSql(d1.calls[0].sql);
    assert.equal(
      sql,
      "SELECT live_id AS liveId, status, COUNT(*) AS records, COALESCE(SUM(quantity), 0) AS seats FROM ticket_reservations GROUP BY live_id, status"
    );
    const lower = sql.toLowerCase();
    for (const column of PERSONAL_COLUMNS) assert.equal(new RegExp(`\\b${column}\\b`).test(lower), false, column);
    assert.doesNotMatch(lower, /\bselect\s+\*/);
    assert.doesNotMatch(lower, /\bid\b/);
  });

  test("the response has only liveId, seats, records and pending, and none of the personal values of the rows", async () => {
    const rows = fixture.summary.groupedRows.map((row) => ({
      ...row,
      name: "架空 太郎",
      email: "taro@example.test",
      contact: "090-0000-0000",
      message: "架空の備考",
      internalNote: "架空の内部メモ",
      createdAt: "2026-11-18T10:00:00.000Z",
      id: "fx-res-1",
    }));
    const response = await worker.fetch(summaryRequest(), adminEnv(createD1Stub({ rows }).DB), {});
    const text = await response.text();
    const body = JSON.parse(text);
    assert.deepEqual(Object.keys(body), ["summaries"]);
    assert.ok(body.summaries.length > 0);
    for (const entry of body.summaries) assert.deepEqual(Object.keys(entry).sort(), ["liveId", "pending", "records", "seats"]);
    for (const value of ["架空 太郎", "taro@example.test", "090-0000-0000", "架空の備考", "架空の内部メモ", "2026-11-18", "fx-res-1"]) {
      assert.equal(text.includes(value), false, value);
    }
  });

  test("the response is not cached and carries the same CORS headers as the other admin routes", async () => {
    const response = await worker.fetch(
      summaryRequest({ origin: "https://1212hp.com" }),
      adminEnv(createD1Stub().DB, { ALLOWED_ORIGINS: "https://1212hp.com,http://127.0.0.1:8080" }),
      {}
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store, max-age=0");
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://1212hp.com");
    assert.equal(response.headers.get("Access-Control-Allow-Methods"), "GET, PUT, POST, OPTIONS");
    assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Authorization, Content-Type, X-Admin-Token");
    assert.deepEqual(await response.json(), { summaries: [] });
  });

  test("OPTIONS answers 204 with GET allowed, and a POST to the route is not a route", async () => {
    const preflight = await worker.fetch(
      new Request(`https://worker.test${SUMMARY_PATH}`, {
        method: "OPTIONS",
        headers: { Origin: "http://127.0.0.1:8080", "Access-Control-Request-Method": "GET" },
      }),
      adminEnv(createD1Stub().DB),
      {}
    );
    assert.equal(preflight.status, 204);
    assert.match(preflight.headers.get("Access-Control-Allow-Methods"), /\bGET\b/);

    const d1 = createD1Stub();
    const post = await worker.fetch(summaryRequest({ method: "POST" }), adminEnv(d1.DB), {});
    assert.equal(post.status, 404);
    assert.equal(d1.calls.length, 0);
  });
});

describe("summarizeTicketReservationRows", () => {
  const row = (liveId, status, records, seats) => ({ liveId, status, records, seats });

  test("pending only, handled only, and mixed rows", () => {
    assert.deepEqual(summarizeTicketReservationRows([row("a", "pending", 2, 5)]), [{ liveId: "a", seats: 5, records: 2, pending: 2 }]);
    assert.deepEqual(summarizeTicketReservationRows([row("a", "handled", 3, 4)]), [{ liveId: "a", seats: 4, records: 3, pending: 0 }]);
    assert.deepEqual(
      summarizeTicketReservationRows([row("a", "pending", 1, 2), row("a", "handled", 2, 3)]),
      [{ liveId: "a", seats: 5, records: 3, pending: 1 }]
    );
  });

  test("cancelled rows count nowhere, and a live with only cancelled rows is left out", () => {
    assert.deepEqual(
      summarizeTicketReservationRows([row("a", "pending", 1, 2), row("a", "cancelled", 5, 9)]),
      [{ liveId: "a", seats: 2, records: 1, pending: 1 }]
    );
    assert.deepEqual(summarizeTicketReservationRows([row("a", "cancelled", 2, 5)]), []);
  });

  test("manual and web rows are counted the same (source is not part of the rule)", () => {
    const rows = [
      { liveId: "a", status: "handled", records: 1, seats: 3, source: "manual" },
      { liveId: "a", status: "handled", records: 1, seats: 2, source: "web" },
    ];
    assert.deepEqual(summarizeTicketReservationRows(rows), [{ liveId: "a", seats: 5, records: 2, pending: 0 }]);
  });

  test("a seats value that is not a number counts as 0 while the records are still counted", () => {
    for (const seats of [null, undefined, "abc", NaN, Infinity, {}]) {
      assert.deepEqual(summarizeTicketReservationRows([row("a", "pending", 2, seats)]), [{ liveId: "a", seats: 0, records: 2, pending: 2 }], String(seats));
    }
    assert.deepEqual(summarizeTicketReservationRows([row("a", "handled", 1, "4")]), [{ liveId: "a", seats: 4, records: 1, pending: 0 }]);
  });

  test("rows come out ordered by liveId, and an empty or non-array input is an empty list", () => {
    const out = summarizeTicketReservationRows([row("c", "handled", 1, 1), row("a", "handled", 1, 1), row("b", "pending", 1, 1)]);
    assert.deepEqual(out.map((entry) => entry.liveId), ["a", "b", "c"]);
    for (const input of [[], null, undefined, "x", {}]) assert.deepEqual(summarizeTicketReservationRows(input), []);
  });

  test("rows without a live id are ignored, and the input is not modified", () => {
    const input = [row("", "pending", 1, 1), row(null, "pending", 1, 1), row("a", "pending", 1, 1)];
    const copy = JSON.parse(JSON.stringify(input));
    assert.deepEqual(summarizeTicketReservationRows(input), [{ liveId: "a", seats: 1, records: 1, pending: 1 }]);
    assert.deepEqual(input, copy);
  });

  test("a status that is not cancelled counts like the ledger does (only cancelled is excluded)", () => {
    assert.deepEqual(
      summarizeTicketReservationRows([row("a", "unknown", 1, 2), row("a", null, 1, 1)]),
      [{ liveId: "a", seats: 3, records: 2, pending: 0 }]
    );
  });
});
