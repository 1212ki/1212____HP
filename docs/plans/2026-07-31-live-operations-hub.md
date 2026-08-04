# 1212HP Live Operations Hub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Make each Live the operational hub for pasted event intake, correct ticket routing, split X announcement preparation, and unified web/manual holds.

**Architecture:** Keep the static HTML/CSS/JavaScript and Cloudflare Worker/D1 stack. Add one dependency-free shared Live operations module used by admin and public pages, extend the existing reservation table additively for manual holds, and preserve legacy `live.link` as an unrelated detail field while introducing authoritative `ticketUrl` with conservative booking-only legacy inference.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Node test runner, Cloudflare Worker, D1 SQLite.

**Repository policy override:** Do not commit, push, open a PR, merge, deploy, or apply production migrations. The workspace policy overrides the skill's example commit steps; leave a verified uncommitted worktree diff.

---

### Task 1: Shared Live parsing, reservation routing, and X composition

**Files:**
- Create: `assets/js/live-operations.js`
- Create: `test/live-operations.test.mjs`

**Step 1: Write failing tests**

Cover at least:

```js
assert.equal(parseLiveSourceText(sample).draft.venue, "柴崎mod");
assert.equal(parseLiveSourceText(sample).draft.ticketUrl, "https://tiget.net/events/510753");
assert.equal(getTicketUrl({ ticketUrl: "https://tiget.net/x", link: "legacy" }), "https://tiget.net/x");
assert.equal(getTicketUrl({ ticketUrl: "", link: "https://tiget.net/legacy" }), "");
assert.equal(getTicketUrl({ link: "https://tiget.net/events/legacy" }), "https://tiget.net/events/legacy");
assert.equal(getTicketUrl({ link: "https://instagram.com/example" }), "");
assert.match(buildXParentText(live, "ぜひ来てください", canonicalUrl), /#ライブ/);
assert.match(buildXParentText(live, "ぜひ来てください", canonicalUrl), /ぜひ来てください/);
assert.match(buildXParentText(live, "ぜひ来てください", canonicalUrl), new RegExp(canonicalUrl));
assert.doesNotMatch(buildXParentText(live, "ぜひ来てください", canonicalUrl), /open\/start/);
assert.match(buildXReplyText(live), /open\/start/);
```

Also test empty input, multiple date styles, `open/start`, lineup markers, URL
cleanup, weekday mismatch warnings, explicit-empty `ticketUrl`, conservative
legacy-link inference, `reservationClosed`, source-text preservation, and no
automatic mutation/publish side effect.

**Step 2: Run RED**

Run: `node --test test/live-operations.test.mjs`

Expected: FAIL because `assets/js/live-operations.js` or its exported functions do not exist.

**Step 3: Implement the minimal shared module**

Expose browser and Node-compatible functions without a dependency:

- `parseLiveSourceText(text)`
- `getTicketUrl(live)` (`ticketUrl` property is authoritative even when empty;
  infer legacy `link` only when it is recognizably a booking URL and never for
  social/profile URLs)
- `getTicketCta(live, internalUrl, options)`
- `buildXParentText(live, comment, canonicalUrl)`
- `buildXReplyText(live)`
- date/weekday warning helpers needed by the parser

Keep extraction conservative. Preserve `sourceText`; return `{ draft, warnings }`; never save or publish.

**Step 4: Run GREEN and refactor**

Run: `node --test test/live-operations.test.mjs`

Expected: PASS. Refactor only while the test stays green.

### Task 2: Additive manual-hold API and D1 migration

**Files:**
- Modify: `cloudflare/worker/schema.sql`
- Create: `cloudflare/worker/migrations/0001_manual_ticket_reservations.sql`
- Modify: `cloudflare/worker/src/worker.js`
- Create or modify: `cloudflare/worker/test/manual-ticket-reservations.test.js`
- Modify: `cloudflare/worker/README.md`

**Step 1: Write failing tests**

Test that:

- public reservations are normalized as `source: "web"` and still require valid email;
- manual reservations accept `liveId`, name, quantity 1-10, optional contact
  (maximum 200 characters), and optional note (maximum 2000 characters) with
  no email;
- manual reservations start as handled/confirmed operational records, bypass
  the public email deduplication path, and do not call public
  notification/autoreply helpers;
- manual reservation `source` is fixed to `manual` by the server regardless of
  client input, while existing/public records remain `web`;
- list responses and CSV remain backward compatible while including source/contact/internal note where appropriate;
- invalid Live, quantity, and status return existing error conventions.
- a manual hold can be added to a Live even when that Live has an external
  ticket URL.

**Step 2: Run RED**

Run: `npm test -- --test-name-pattern="manual|reservation source"`

Expected: focused tests FAIL because the manual reservation behavior/columns are absent.

**Step 3: Implement additive schema/API changes**

- Add `source`, `contact`, and `internal_note` columns to new-install schema.
- Add a tracked, one-time additive migration file for an existing D1 database.
  Document `PRAGMA table_info` preflight/postflight and the required order:
  migration first, Worker deploy second. Do not apply the migration in this task.
- Add authenticated `POST /api/admin/ticket-reservations` for manual holds.
- Keep `POST /api/public/ticket-reservations` behavior and notifications unchanged.
- Keep the existing non-null email column by storing an empty email only on the
  admin-only manual path. Do not reuse the public duplicate-email validator.
- Return the new fields from admin listing and append them to CSV without
  changing the order or meanings of existing columns. Never return
  `internalNote` from a public endpoint.

**Step 4: Run GREEN**

Run: `npm test`

Expected: all Worker tests PASS.

### Task 3: Make Live the admin operations hub

**Files:**
- Modify: `admin/index.html`
- Modify: `admin/app.js`
- Modify: `admin/style.css`
- Create or modify: `test/admin-live-operations.test.mjs`

**Step 1: Write failing tests**

Assert the rendered/admin source contract includes:

- Live as the initially active primary tab;
- no independent Tickets button in the primary tab bar; cross-Live ledger and
  Ticket Page settings are secondary sections under Live operations;
- source-text paste area and parse action;
- canonical `ticketUrl` field labeled as a reservation URL;
- `reservationClosed` control with a false default;
- split parent/reply X controls;
- a per-Live reservation ledger and manual-hold entry point;
- API request payload for manual holds and source/seat totals in the ledger.

**Step 2: Run RED**

Run: `node --test test/admin-live-operations.test.mjs`

Expected: FAIL because the hub UI and handlers are absent.

**Step 3: Implement the admin flow**

- Load `live-operations.js` before `app.js`.
- Put source paste/extract at the top of New/Edit Live; display warnings and populated draft without saving.
- Save `sourceText`, `ticketUrl`, `reservationClosed`, and owner X comment on
  the Live object. Merge into the existing Live so unrelated properties survive.
  On a legacy record without `ticketUrl`, prefill only a recognizably booking
  `link`; keep social/profile/detail `link` values out of reservation routing.
- Replace the single generated tweet with parent preview/open and reply preview/copy.
- Embed per-Live reservation counts/list and manual-hold form in Live edit.
- Remove Tickets from the primary tab bar. Keep the cross-Live reservation
  list, Ticket Page copy/settings, status operations, and CSV export as
  secondary sections inside Live operations (or Site settings).
- Preserve image upload/download and modal save behavior.

**Step 4: Run GREEN**

Run: `node --test test/admin-live-operations.test.mjs test/admin-image-form.test.mjs`

Expected: all admin tests PASS.

### Task 4: Apply consistent public reservation routing

**Files:**
- Modify: `assets/js/site-content.js`
- Modify: `assets/js/ticket.js`
- Modify: `assets/css/style.css`
- Modify: `index.html`
- Modify: `live/index.html`
- Modify: `live/detail/index.html`
- Modify: `ticket/index.html`
- Modify other public page HTML files only to remove the generic Ticket navigation item and load the shared helper where needed.
- Create or modify: `test/public-ticket-routing.test.mjs`

**Step 1: Write failing tests**

Cover the route matrix:

```text
upcoming + external ticket URL -> exact external URL and external label
upcoming + no ticket URL       -> /ticket/?liveId=<id>
past/closed                     -> no active reservation CTA
direct /ticket/ list            -> internal-only Lives
ticketUrl explicitly empty      -> internal even when legacy link is present
legacy social/profile link      -> internal, never the social URL
```

Also assert Home, Live list, and Live detail use the shared routing and that generic global Ticket navigation is removed while `/ticket/` remains present.

**Step 2: Run RED**

Run: `node --test test/public-ticket-routing.test.mjs`

Expected: FAIL under the current always-internal routing.

**Step 3: Implement the public experience**

- Home: keep the existing Next Live card but route its primary CTA correctly.
- Live list: remove the generic top Ticket link; show per-Live reserve and detail actions.
- Live detail: show one prominent reservation CTA; external links open safely in a new tab; internal links preserve `liveId`; past Live has no active reservation CTA.
- Ticket form: list only internal-reservation upcoming, open Lives and reject
  an external, past, or reservationClosed Live deep-link with a clear route
  message rather than silently selecting another Live.
- Remove Ticket from global navigation without deleting the ticket page.
- Maintain existing design tokens; add a restrained mobile sticky CTA only where it improves the detail flow.

**Step 4: Run GREEN**

Run: `node --test test/public-ticket-routing.test.mjs`

Expected: PASS.

### Task 5: Full verification and handoff evidence

**Files:**
- Modify documentation only if required to describe migration/setup.

**Step 1: Run all automated tests**

Run:

```bash
node --test test/*.test.mjs
cd cloudflare/worker && npm test
```

Expected: all tests PASS with no new warnings/errors.

**Step 2: Inspect scope and sensitive files**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Confirm no secrets, credentials, dependency changes, unrelated content changes, commits, or external writes.

**Step 3: Separate reviews**

Run an AC1-AC8 spec review first. Only after approval, run code-quality/adversarial review. Any blocking issue must be fixed by an implementation Worker and re-reviewed.
