import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mainCss = readFileSync(new URL("./main.css", import.meta.url), "utf8");
const exportDimensionCss = readFileSync(
  new URL("./export-dimension.css", import.meta.url),
  "utf8",
);
const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("keeps Export Dimension styles outside main.css", () => {
  assert.doesNotMatch(mainCss, /\.export-dimension-/);
  assert.match(exportDimensionCss, /\.export-dimension-filter-panel\s*{/);
  assert.match(exportDimensionCss, /\.export-dimension-table\s*{/);
  assert.match(exportDimensionCss, /@media \(max-width: 720px\)/);
});

test("loads Export Dimension styles after main styles", () => {
  const mainIndex = indexHtml.indexOf("./src/styles/main.css");
  const exportDimensionIndex = indexHtml.indexOf("./src/styles/export-dimension.css");

  assert.notEqual(mainIndex, -1);
  assert.notEqual(exportDimensionIndex, -1);
  assert.ok(mainIndex < exportDimensionIndex);
});
