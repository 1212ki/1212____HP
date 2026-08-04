import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  formatLiveDateForDisplay,
  formatLiveDetailsForDisplay,
} from "../src/worker.js";

const cases = JSON.parse(await readFile(
  new URL("../../../test/fixtures/live-format-cases.json", import.meta.url),
  "utf8",
));

test("Worker Live formatters satisfy the shared fixture matrix", () => {
  for (const fixture of cases.dates) {
    assert.equal(formatLiveDateForDisplay(fixture.input), fixture.expected, fixture.name);
  }
  for (const fixture of cases.details) {
    assert.equal(formatLiveDetailsForDisplay(fixture.live), fixture.expected, fixture.name);
  }
});
