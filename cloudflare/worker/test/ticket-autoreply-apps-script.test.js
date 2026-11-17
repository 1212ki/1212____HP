import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function run({ patch = {}, missing, duplicate, token = "test-token", type = "application/x-www-form-urlencoded;charset=UTF-8", gmailError = false, eventMissing = false } = {}) {
  const source = readFileSync(new URL("../apps-script/ticket-autoreply.gs", import.meta.url), "utf8");
  const parameter = { token: "test-token", receipt_id: " ticket_test ", live: " 2099-06-01 架空Hall ", name: " 山田 太郎 ", email: " taro@example.com ", quantity: " 2 ", message: " 日本語 &+\n二行目 ", ...patch };
  if (missing) delete parameter[missing];
  const parameters = Object.fromEntries(Object.entries(parameter).map(([key, value]) => [key, [value]]));
  if (duplicate) parameters[duplicate].push(parameter[duplicate]);
  const calls = [];
  const context = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => { assert.equal(key, "TICKET_AUTOREPLY_TOKEN"); return token; } }) },
    ContentService: { MimeType: { JSON: "application/json" }, createTextOutput: (text) => ({ text, setMimeType(mime) { this.mime = mime; return this; } }) },
    GmailApp: { sendEmail(...args) { if (gmailError) throw new Error("private gmail error"); calls.push(args); } },
  };
  vm.runInNewContext(source, context);
  assert.equal(typeof context.doGet, "undefined");
  const result = context.doPost(eventMissing ? undefined : { postData: { type }, parameter, parameters });
  assert.equal(result.mime, "application/json");
  return { result: JSON.parse(result.text), calls: JSON.parse(JSON.stringify(calls)) };
}
test("Gmail sends exactly one fixed receipt to applicant with owner BCC", () => {
  const { result, calls } = run({ patch: { to: "attacker@example.com", bcc: "attacker@example.com", subject: "override", body: "override" } });
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, [["taro@example.com", "ticket予約の控え | 松本一樹", [
    "ticket予約を受け付けました。", "", "受付ID: ticket_test", "ライブ: 2099-06-01 架空Hall", "名前: 山田 太郎", "e-mail: taro@example.com", "枚数: 2", "備考: 日本語 &+\n二行目", "", "当日はお気をつけてお越しください。",
  ].join("\n"), { name: "松本一樹 ticket", bcc: "1212ki.info@gmail.com" }]]);
});
test("blank message becomes なし and quantity 10 is valid", () => {
  const { result, calls } = run({ patch: { message: " \t", quantity: "10" } });
  assert.deepEqual(result, { ok: true });
  assert.match(calls[0][2], /枚数: 10\n備考: なし/);
});
const invalid = [
  ["wrong token", { patch: { token: "wrong" } }], ["token whitespace exact", { patch: { token: " test-token " } }],
  ["unconfigured", { token: "" }], ["missing event", { eventMissing: true }],
  ["wrong MIME", { type: "application/json" }], ["Gmail exception", { gmailError: true }],
  ...["token", "receipt_id", "live", "name", "email", "quantity", "message"].map((key) => [`missing ${key}`, { missing: key }]),
  ...["receipt_id", "live", "name", "email", "quantity"].map((key) => [`blank ${key}`, { patch: { [key]: " \t" } }]),
  ...["token", "receipt_id", "live", "name", "email", "quantity", "message"].map((key) => [`duplicate ${key}`, { duplicate: key }]),
  ...["receipt_id", "live", "name"].map((key) => [`CRLF ${key}`, { patch: { [key]: "one\r\ntwo" } }]),
  ...["a@example.com,b@example.com", "a@example.com;b@example.com", "Name <a@example.com>", "a@example.com\r\nb@example.com", "invalid"].map((email) => [`email ${JSON.stringify(email)}`, { patch: { email } }]),
  ...["0", "11", "1.5"].map((quantity) => [`quantity ${quantity}`, { patch: { quantity } }]),
];
for (const [label, options] of invalid) {
  test(`rejects ${label} without sending`, () => {
    const { result, calls } = run(options);
    assert.deepEqual(result, { ok: false });
    assert.deepEqual(calls, []);
  });
}
