import assert from 'node:assert/strict';
import test from 'node:test';

const values = new Map();

globalThis.sessionStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key)
};

const browserStorage = await import('./browser-storage.utils.js');

test.beforeEach(() => {
  values.clear();
});

test('remembers and clears the current Lot inspection location', () => {
  assert.equal(typeof browserStorage.rememberLotInspectionLocation, 'function');
  assert.equal(typeof browserStorage.getLotInspectionLocation, 'function');
  assert.equal(typeof browserStorage.clearLotInspectionLocation, 'function');

  browserStorage.rememberLotInspectionLocation({
    lotNumber: '260605001',
    activeTab: 'packing',
    isReadOnly: false
  });

  assert.deepEqual(browserStorage.getLotInspectionLocation(), {
    lotNumber: '260605001',
    activeTab: 'packing',
    isReadOnly: false
  });

  browserStorage.clearLotInspectionLocation();
  assert.equal(browserStorage.getLotInspectionLocation(), null);
});

test('ignores invalid Lot inspection location values', () => {
  assert.equal(typeof browserStorage.rememberLotInspectionLocation, 'function');
  assert.equal(typeof browserStorage.getLotInspectionLocation, 'function');

  browserStorage.rememberLotInspectionLocation({
    lotNumber: '../wrong-lot',
    activeTab: 'other',
    isReadOnly: false
  });

  assert.equal(browserStorage.getLotInspectionLocation(), null);
});
