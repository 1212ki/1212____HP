import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { describe } from "node:test";

import worker from "../src/worker.js";

const siteData = {
  live: {
    ticketLink: "",
    upcoming: [
      {
        id: "live_internal",
        date: "2099-08-09",
        venue: "Internal Hall",
        ticketUrl: "",
        link: "https://tiget.net/events/explicit-empty-must-win",
      },
      {
        id: "live_external",
        date: "2099-08-10",
        venue: "External Hall",
        ticketUrl: "https://tickets.example/live_external",
      },
      {
        id: "live_invalid_ticket",
        date: "2099-08-11",
        venue: "Invalid Ticket Hall",
        ticketUrl: "javascript:alert(1)",
      },
      {
        id: "live_closed",
        date: "2099-08-12",
        venue: "Closed Hall",
        ticketUrl: "",
        reservationClosed: true,
      },
      {
        id: "live_dated_past",
        date: "2000-01-10",
        venue: "Past Date Hall",
        ticketUrl: "",
      },
      {
        id: "live_legacy_booking",
        date: "2099-08-13",
        venue: "Legacy Booking Hall",
        link: "https://eplus.jp/sf/detail/123456",
      },
      {
        id: "live_legacy_social",
        date: "2099-08-14",
        venue: "Legacy Social Hall",
        link: "https://instagram.com/1212",
      },
      {
        id: "live_legacy_profile",
        date: "2099-08-15",
        venue: "Legacy Profile Hall",
        link: "https://example.com/profile/1212",
      },
      {
        id: "live_legacy_detail",
        date: "2099-08-16",
        venue: "Legacy Detail Hall",
        link: "https://1212hp.com/live/detail/?liveId=legacy",
      },
      {
        id: "live_legacy_ordinary",
        date: "2099-08-17",
        venue: "Legacy Ordinary Hall",
        link: "https://example.com/artists/1212",
      },
    ],
    past: [
      {
        id: "live_past",
        date: "2026-01-10",
        venue: "Past Hall",
      },
      {
        id: "live_past_collection_future",
        date: "2099-12-31",
        venue: "Past Collection Hall",
        ticketUrl: "",
      },
    ],
  },
};

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
          if (/FROM site_data/i.test(call.sql)) {
            return {
              data: JSON.stringify(siteData),
              updated_at: "2026-07-31T00:00:00.000Z",
            };
          }
          if (/SELECT id FROM ticket_reservations/i.test(call.sql)) return null;
          return null;
        },
        async all() {
          call.operation = "all";
          return { results: rows };
        },
        async run() {
          call.operation = "run";
          return { success: true, meta: { changes: 1 } };
        },
      };
      return statement;
    },
  };
  return { DB, calls };
}

function jsonRequest(path, body, { authenticated = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authenticated) headers.Authorization = "Bearer test-admin-token";
  return new Request(`https://worker.test${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function adminEnv(db, extra = {}) {
  return { DB: db, ADMIN_SHARED_TOKEN: "test-admin-token", ...extra };
}

function normalizeSql(sql) {
  return String(sql).replace(/\s+/g, " ").trim();
}

describe("manual ticket reservations", () => {
  test("manual POST rejects unauthenticated requests before touching D1", async () => {
    const d1 = createD1Stub();

    const response = await worker.fetch(
      jsonRequest(
        "/api/admin/ticket-reservations",
        { liveId: "live_external", name: "Guest", quantity: 1 },
        { authenticated: false }
      ),
      adminEnv(d1.DB),
      {}
    );

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "unauthorized" });
    assert.equal(d1.calls.length, 0);
  });

  test("manual POST creates a handled hold for an external-ticket Live with exact insert semantics", async () => {
    const d1 = createD1Stub();
    const originalFetch = globalThis.fetch;
    let outboundFetches = 0;
    globalThis.fetch = async () => {
      outboundFetches += 1;
      throw new Error("manual reservation must not perform outbound fetches");
    };

    try {
      const response = await worker.fetch(
        jsonRequest("/api/admin/ticket-reservations", {
          liveId: "live_external",
          name: "  Manual Guest  ",
          quantity: 2,
          contact: "  090-1234-5678  ",
          internalNote: "  paid at door  ",
          source: "web",
          email: "spoof@example.com",
          message: "spoofed public message",
        }),
        adminEnv(d1.DB, {
          LINE_WEBHOOK_URL: "https://notify.invalid",
          TICKET_AUTOREPLY_FORM_URL: "https://autoreply.invalid",
        }),
        {
          waitUntil() {
            assert.fail("manual reservation must not schedule notifications");
          },
        }
      );

      assert.equal(response.status, 201);
      const body = await response.json();
      assert.equal(body.ok, true);
      assert.deepEqual(
        {
          liveId: body.reservation.liveId,
          liveDate: body.reservation.liveDate,
          liveVenue: body.reservation.liveVenue,
          name: body.reservation.name,
          email: body.reservation.email,
          quantity: body.reservation.quantity,
          message: body.reservation.message,
          status: body.reservation.status,
          source: body.reservation.source,
          contact: body.reservation.contact,
          internalNote: body.reservation.internalNote,
        },
        {
          liveId: "live_external",
          liveDate: "2099-08-10",
          liveVenue: "External Hall",
          name: "Manual Guest",
          email: "",
          quantity: 2,
          message: "",
          status: "handled",
          source: "manual",
          contact: "090-1234-5678",
          internalNote: "paid at door",
        }
      );
      assert.match(body.reservation.id, /^ticket_/);
      assert.match(body.reservation.createdAt, /^\d{4}-\d{2}-\d{2}T/);

      const insert = d1.calls.find((call) => /INSERT INTO ticket_reservations/i.test(call.sql));
      assert.ok(insert, "manual reservation should execute an INSERT");
      assert.equal(
        normalizeSql(insert.sql),
        normalizeSql(`INSERT INTO ticket_reservations
          (id, live_id, live_date, live_venue, name, email, quantity, message, status, created_at, updated_at, source, contact, internal_note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      );
      assert.deepEqual(insert.bindings.slice(1, 10), [
        "live_external",
        "2099-08-10",
        "External Hall",
        "Manual Guest",
        "",
        2,
        "",
        "handled",
        insert.bindings[9],
      ]);
      assert.equal(insert.bindings[9], insert.bindings[10]);
      assert.deepEqual(insert.bindings.slice(11), ["manual", "090-1234-5678", "paid at door"]);
      assert.equal(
        d1.calls.some((call) => /SELECT id FROM ticket_reservations/i.test(call.sql)),
        false,
        "manual reservations must bypass public email dedupe"
      );
      assert.equal(outboundFetches, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("manual POST accepts omitted contact and note and accepts a past Live", async () => {
    const d1 = createD1Stub();

    const response = await worker.fetch(
      jsonRequest("/api/admin/ticket-reservations", {
        liveId: "live_past",
        name: "Past Guest",
        quantity: 1,
      }),
      adminEnv(d1.DB),
      {}
    );

    assert.equal(response.status, 201);
    const { reservation } = await response.json();
    assert.equal(reservation.email, "");
    assert.equal(reservation.contact, "");
    assert.equal(reservation.internalNote, "");
    assert.equal(reservation.status, "handled");
    assert.equal(reservation.source, "manual");
  });

  test("manual POST rejects invalid Live, name, quantity, contact, and internal note", async (t) => {
    const invalidCases = [
      ["missing Live", { liveId: "missing", name: "Guest", quantity: 1 }, /live not found/],
      ["blank name", { liveId: "live_external", name: "   ", quantity: 1 }, /name is required/],
      ["non-string name", { liveId: "live_external", name: 42, quantity: 1 }, /name is required/],
      ["zero quantity", { liveId: "live_external", name: "Guest", quantity: 0 }, /quantity is invalid/],
      ["too many", { liveId: "live_external", name: "Guest", quantity: 11 }, /quantity is invalid/],
      ["fractional", { liveId: "live_external", name: "Guest", quantity: 1.5 }, /quantity is invalid/],
      ["string quantity", { liveId: "live_external", name: "Guest", quantity: "2" }, /quantity is invalid/],
      ["contact too long", { liveId: "live_external", name: "Guest", quantity: 1, contact: "c".repeat(201) }, /contact is too long/],
      ["non-string contact", { liveId: "live_external", name: "Guest", quantity: 1, contact: 42 }, /contact is invalid/],
      ["note too long", { liveId: "live_external", name: "Guest", quantity: 1, internalNote: "n".repeat(2001) }, /internalNote is too long/],
      ["non-string note", { liveId: "live_external", name: "Guest", quantity: 1, internalNote: {} }, /internalNote is invalid/],
    ];

    for (const [label, payload, expectedError] of invalidCases) {
      await t.test(label, async () => {
        const d1 = createD1Stub();
        const response = await worker.fetch(
          jsonRequest("/api/admin/ticket-reservations", payload),
          adminEnv(d1.DB),
          {}
        );
        assert.equal(response.status, 400);
        assert.match((await response.json()).error, expectedError);
        assert.equal(
          d1.calls.some((call) => /INSERT INTO ticket_reservations/i.test(call.sql)),
          false
        );
      });
    }
  });

  test("manual admin list defaults legacy source to web and returns admin-only fields", async () => {
    const row = {
      id: "ticket_legacy",
      status: "pending",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
      liveId: "live_external",
      liveDate: "2026-08-10",
      liveVenue: "External Hall",
      name: "Legacy Guest",
      email: "guest@example.com",
      quantity: 1,
      message: "",
      source: "web",
      contact: null,
      internalNote: null,
    };
    const d1 = createD1Stub({ rows: [row] });
    const request = new Request("https://worker.test/api/admin/ticket-reservations?liveId=live_external", {
      headers: { Authorization: "Bearer test-admin-token" },
    });

    const response = await worker.fetch(request, adminEnv(d1.DB), {});

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { reservations: [row] });
    const select = d1.calls.find((call) => call.operation === "all");
    assert.match(normalizeSql(select.sql), /COALESCE\(source, 'web'\) as source, contact, internal_note as internalNote/i);
  });

  test("manual CSV appends source, contact, internalNote after the existing eleven columns", async () => {
    const d1 = createD1Stub({
      rows: [
        {
          id: "ticket_manual",
          status: "handled",
          createdAt: "2026-07-31T01:00:00.000Z",
          updatedAt: "2026-07-31T01:00:00.000Z",
          liveId: "live_external",
          liveDate: "2026-08-10",
          liveVenue: "External Hall",
          name: "Manual Guest",
          email: "",
          quantity: 2,
          message: "",
          source: "manual",
          contact: "@guest",
          internalNote: "door, paid",
        },
      ],
    });
    const request = new Request("https://worker.test/api/admin/ticket-reservations.csv", {
      headers: { Authorization: "Bearer test-admin-token" },
    });

    const response = await worker.fetch(request, adminEnv(d1.DB), {});
    const csv = await response.text();

    assert.equal(response.status, 200);
    assert.equal(
      csv.split("\n")[0],
      "id,status,createdAt,updatedAt,liveId,liveDate,liveVenue,name,email,quantity,message,source,contact,internalNote"
    );
    assert.match(csv, /,manual,'@guest,"door, paid"\n$/);
  });

  test("authenticated CSV neutralizes formula prefixes without changing stored public or manual values", async () => {
    const rows = [];
    const d1 = createD1Stub({ rows });
    const publicPayload = {
      liveId: "live_internal",
      name: "=2+2",
      email: "+attacker@example.com",
      quantity: 2,
      message: "-10+20",
    };
    const scheduled = [];

    const publicResponse = await worker.fetch(
      jsonRequest("/api/public/ticket-reservations", publicPayload, { authenticated: false }),
      adminEnv(d1.DB),
      { waitUntil(promise) { scheduled.push(promise); } }
    );
    await Promise.all(scheduled);

    assert.equal(publicResponse.status, 201);
    const publicBody = await publicResponse.json();
    assert.deepEqual(
      {
        name: publicBody.reservation.name,
        email: publicBody.reservation.email,
        quantity: publicBody.reservation.quantity,
        message: publicBody.reservation.message,
      },
      {
        name: "=2+2",
        email: "+attacker@example.com",
        quantity: 2,
        message: "-10+20",
      }
    );

    const insert = d1.calls.find((call) => /INSERT INTO ticket_reservations/i.test(call.sql));
    assert.ok(insert, "public POST should persist the reservation before export");
    rows.push({
      id: insert.bindings[0],
      liveId: insert.bindings[1],
      liveDate: insert.bindings[2],
      liveVenue: insert.bindings[3],
      name: insert.bindings[4],
      email: insert.bindings[5],
      quantity: insert.bindings[6],
      message: insert.bindings[7],
      status: insert.bindings[8],
      createdAt: insert.bindings[9],
      updatedAt: insert.bindings[10],
      source: insert.bindings[11],
      contact: null,
      internalNote: null,
    });
    assert.deepEqual(
      {
        name: rows[0].name,
        email: rows[0].email,
        quantity: rows[0].quantity,
        message: rows[0].message,
      },
      {
        name: "=2+2",
        email: "+attacker@example.com",
        quantity: 2,
        message: "-10+20",
      },
      "the D1-bound values must stay unchanged"
    );

    rows.push({
      id: "ticket_manual_formula",
      status: "handled",
      createdAt: "2026-07-31T02:00:00.000Z",
      updatedAt: "2026-07-31T02:00:00.000Z",
      liveId: "live_external",
      liveDate: "2099-08-10",
      liveVenue: "Ordinary Hall",
      name: " \t=Manual Guest",
      email: "",
      quantity: -3,
      message: "\u000b+shared field",
      source: "manual",
      contact: "\u0001-090-1234-5678",
      internalNote: "\u007f@SUM(\"A1,A2\")\nnext line",
    });

    const csvResponse = await worker.fetch(
      new Request("https://worker.test/api/admin/ticket-reservations.csv", {
        headers: { Authorization: "Bearer test-admin-token" },
      }),
      adminEnv(d1.DB),
      {}
    );
    const csv = await csvResponse.text();

    assert.equal(csvResponse.status, 200);
    const expectedPublicRow = [
      rows[0].id,
      "pending",
      rows[0].createdAt,
      rows[0].updatedAt,
      "live_internal",
      "2099-08-09",
      "Internal Hall",
      "'=2+2",
      "'+attacker@example.com",
      "2",
      "'-10+20",
      "web",
      "",
      "",
    ].join(",");
    const expectedManualRow = [
      "ticket_manual_formula",
      "handled",
      "2026-07-31T02:00:00.000Z",
      "2026-07-31T02:00:00.000Z",
      "live_external",
      "2099-08-10",
      "Ordinary Hall",
      "' \t=Manual Guest",
      "",
      "-3",
      "'\u000b+shared field",
      "manual",
      "'\u0001-090-1234-5678",
      "\"'\u007f@SUM(\"\"A1,A2\"\")\nnext line\"",
    ].join(",");
    assert.match(csv, new RegExp(`${expectedPublicRow.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n`));
    assert.ok(csv.endsWith(`${expectedManualRow}\n`), "manual fields should share neutralization and RFC quoting");
    assert.match(csv, /,Ordinary Hall,/);
    assert.match(csv, /,-3,/);
    assert.doesNotMatch(csv, /,'-3,/);
  });

  test("manual changes preserve the existing authenticated status endpoint", async () => {
    const d1 = createD1Stub();
    const response = await worker.fetch(
      jsonRequest("/api/admin/ticket-reservations/ticket_manual/status", { status: "cancelled" }),
      adminEnv(d1.DB),
      {}
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.updated.id, "ticket_manual");
    assert.equal(body.updated.status, "cancelled");
    const update = d1.calls.find((call) => /UPDATE ticket_reservations SET status/i.test(call.sql));
    assert.deepEqual(update.bindings.slice(0, 2), ["cancelled", body.updated.updatedAt]);
    assert.equal(update.bindings[2], "ticket_manual");
  });

  test("manual changes preserve invalid status rejection without issuing an UPDATE", async () => {
    const d1 = createD1Stub();
    const response = await worker.fetch(
      jsonRequest("/api/admin/ticket-reservations/ticket_manual/status", { status: "unknown" }),
      adminEnv(d1.DB),
      {}
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "invalid status" });
    assert.equal(
      d1.calls.some((call) => /UPDATE ticket_reservations SET status/i.test(call.sql)),
      false
    );
  });

  test("explicit-empty internal reservation remains web and public notifications still run", async () => {
    const d1 = createD1Stub();
    const scheduled = [];
    const outbound = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      outbound.push({ url: String(url), options });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    try {
      const response = await worker.fetch(
        jsonRequest(
          "/api/public/ticket-reservations",
          {
            liveId: "live_internal",
            name: "Web Guest",
            email: "web@example.com",
            quantity: 2,
            message: "web message",
            source: "manual",
            internalNote: "must not leak",
          },
          { authenticated: false }
        ),
        adminEnv(d1.DB, {
          LINE_WEBHOOK_URL: "https://notify.example/webhook",
          TICKET_AUTOREPLY_FORM_URL: "https://forms.example/reply",
        }),
        { waitUntil(promise) { scheduled.push(promise); } }
      );

      assert.equal(response.status, 201);
      const body = await response.json();
      assert.equal(body.reservation.source, "web");
      assert.equal(body.reservation.liveId, "live_internal");
      assert.equal("internalNote" in body.reservation, false);
      assert.equal("contact" in body.reservation, false);

      await Promise.all(scheduled);
      assert.deepEqual(outbound.map((item) => item.url).sort(), [
        "https://forms.example/reply",
        "https://notify.example/webhook",
      ]);
      const webhookCall = outbound.find((item) => item.url === "https://notify.example/webhook");
      const webhookPayload = JSON.parse(webhookCall.options.body);
      assert.equal(webhookPayload.reservation.source, "web");
      assert.equal("internalNote" in webhookPayload.reservation, false);

      assert.equal(
        d1.calls.some((call) => /SELECT id FROM ticket_reservations/i.test(call.sql)),
        false,
        "public email dedupe must be part of the atomic insert"
      );
      const insert = d1.calls.find((call) => /INSERT INTO ticket_reservations/i.test(call.sql));
      assert.match(normalizeSql(insert.sql), /updated_at, source\) SELECT/i);
      assert.match(normalizeSql(insert.sql), /WHERE NOT EXISTS/i);
      assert.equal(insert.bindings[11], "web");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("public POST rejects tampered ineligible Live IDs before D1 write and notifications", async (t) => {
    const ineligibleCases = [
      ["authoritative external ticketUrl", "live_external"],
      ["invalid authoritative ticketUrl", "live_invalid_ticket"],
      ["reservation closed", "live_closed"],
      ["upcoming collection item dated before today", "live_dated_past"],
      ["past collection item even with a future date", "live_past_collection_future"],
      ["legacy recognizable booking link", "live_legacy_booking"],
    ];

    for (const [label, liveId] of ineligibleCases) {
      await t.test(label, async () => {
        const d1 = createD1Stub();
        const scheduled = [];
        let outboundFetches = 0;
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async () => {
          outboundFetches += 1;
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        };

        try {
          const response = await worker.fetch(
            jsonRequest(
              "/api/public/ticket-reservations",
              {
                liveId,
                name: "Tampered Guest",
                email: `${liveId}@example.com`,
                quantity: 1,
              },
              { authenticated: false }
            ),
            adminEnv(d1.DB, {
              LINE_WEBHOOK_URL: "https://notify.example/webhook",
              TICKET_AUTOREPLY_FORM_URL: "https://forms.example/reply",
            }),
            { waitUntil(promise) { scheduled.push(promise); } }
          );
          await Promise.all(scheduled);
          const body = await response.json();

          assert.equal(response.status, 400);
          assert.deepEqual(Object.keys(body), ["error"]);
          assert.equal(typeof body.error, "string");
          assert.equal(
            d1.calls.some((call) => /SELECT id FROM ticket_reservations/i.test(call.sql)),
            false,
            "public rejection must happen before dedupe"
          );
          assert.equal(
            d1.calls.some((call) => /INSERT INTO ticket_reservations/i.test(call.sql)),
            false,
            "public rejection must happen before insert"
          );
          assert.equal(scheduled.length, 0, "public rejection must not schedule notifications");
          assert.equal(outboundFetches, 0, "public rejection must not issue notification fetches");
        } finally {
          globalThis.fetch = originalFetch;
        }
      });
    }
  });

  test("public POST accepts explicit-empty and missing-property non-booking internal routes", async (t) => {
    const eligibleCases = [
      ["explicit-empty ticketUrl overrides recognizable booking link", "live_internal"],
      ["missing ticketUrl with social link", "live_legacy_social"],
      ["missing ticketUrl with profile link", "live_legacy_profile"],
      ["missing ticketUrl with Live detail link", "live_legacy_detail"],
      ["missing ticketUrl with ordinary link", "live_legacy_ordinary"],
    ];

    for (const [label, liveId] of eligibleCases) {
      await t.test(label, async () => {
        const d1 = createD1Stub();
        const scheduled = [];
        const response = await worker.fetch(
          jsonRequest(
            "/api/public/ticket-reservations",
            {
              liveId,
              name: "Internal Guest",
              email: `${liveId}@example.com`,
              quantity: 1,
            },
            { authenticated: false }
          ),
          adminEnv(d1.DB),
          { waitUntil(promise) { scheduled.push(promise); } }
        );
        await Promise.all(scheduled);
        const body = await response.json();

        assert.equal(response.status, 201);
        assert.equal(body.reservation.liveId, liveId);
        assert.equal(body.reservation.source, "web");
        assert.ok(d1.calls.some((call) => /INSERT INTO ticket_reservations/i.test(call.sql)));
      });
    }
  });

  test("reservation source changes do not weaken public email validation", async () => {
    const d1 = createD1Stub();
    const response = await worker.fetch(
      jsonRequest(
        "/api/public/ticket-reservations",
        { liveId: "live_external", name: "Web Guest", email: "invalid", quantity: 1 },
        { authenticated: false }
      ),
      adminEnv(d1.DB),
      {}
    );

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /email is invalid/);
    assert.equal(
      d1.calls.some((call) => /INSERT INTO ticket_reservations/i.test(call.sql)),
      false
    );
  });

  test("manual reservation schema and one-time migration are additive and documented", async () => {
    const [schema, migration, readme] = await Promise.all([
      readFile(new URL("../schema.sql", import.meta.url), "utf8"),
      readFile(new URL("../migrations/0001_manual_ticket_reservations.sql", import.meta.url), "utf8"),
      readFile(new URL("../README.md", import.meta.url), "utf8"),
    ]);

    assert.match(schema, /source TEXT NOT NULL DEFAULT 'web'/);
    assert.match(schema, /contact TEXT/);
    assert.match(schema, /internal_note TEXT/);

    assert.match(migration, /ALTER TABLE ticket_reservations ADD COLUMN source TEXT NOT NULL DEFAULT 'web';/);
    assert.match(migration, /ALTER TABLE ticket_reservations ADD COLUMN contact TEXT;/);
    assert.match(migration, /ALTER TABLE ticket_reservations ADD COLUMN internal_note TEXT;/);
    assert.equal((migration.match(/ALTER TABLE/gi) || []).length, 3);
    assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN)|DELETE\s+FROM/i);

    assert.match(readme, /PRAGMA table_info\(['"]?ticket_reservations['"]?\)/i);
    assert.match(readme, /preflight|事前確認/i);
    assert.match(readme, /postflight|事後確認/i);
    assert.match(readme, /migration[^\n]*first|migration[^\n]*先|マイグレーション[^\n]*先/i);
    assert.match(readme, /Worker[^\n]*(deploy|デプロイ)[^\n]*(second|後)|Worker[^\n]*(second|後)/i);

    const pragmaCommand = `npx wrangler d1 execute itsuki-homepage --remote --command="PRAGMA table_info('ticket_reservations');"`;
    const migrationCommand = "npx wrangler d1 execute itsuki-homepage --remote --file=./migrations/0001_manual_ticket_reservations.sql";
    const pragmaPositions = [...readme.matchAll(new RegExp(pragmaCommand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))]
      .map((match) => match.index);
    const migrationPosition = readme.indexOf(migrationCommand);
    const deployPosition = readme.indexOf("新しいWorkerをデプロイ", migrationPosition);

    assert.equal(pragmaPositions.length, 2, "README must include remote preflight and postflight commands");
    assert.notEqual(migrationPosition, -1, "README must include the remote migration command");
    assert.ok(pragmaPositions[0] < migrationPosition);
    assert.ok(migrationPosition < pragmaPositions[1]);
    assert.ok(pragmaPositions[1] < deployPosition);
    assert.match(readme, /3列すべて[^\n]*存在しない|source[^\n]*contact[^\n]*internal_note[^\n]*すべて[^\n]*存在しない/i);
    assert.match(readme, /一部[^\n]*(存在|追加)[^\n]*(停止|中止)|すでに[^\n]*(存在|追加)[^\n]*(停止|中止)/i);
    assert.match(readme, /(再実行しない|再実行してはいけません|再適用しない)/i);
  });
});
