import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('results read-only detail does not silently hide packing load errors', () => {
  const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /catch\s*\{\s*lotPackingInspectionData = null;/);
});
