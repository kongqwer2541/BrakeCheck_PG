import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8');

test('restores the saved Lot inspection after refresh', () => {
  assert.match(source, /getLotInspectionLocation\(\)/);
  assert.match(source, /await loadLotInspection\(savedInspection\.lotNumber, savedInspection\.activeTab\)/);
  assert.match(source, /rememberLotInspectionLocation\(\{/);
});

test('clears the saved Lot inspection when leaving the workflow', () => {
  assert.match(source, /function handleBackToLotLookup\(\)[\s\S]*?clearLotInspectionLocation\(\)/);
  assert.match(source, /async function handleLogout\(\)[\s\S]*?clearLotInspectionLocation\(\)/);
});
