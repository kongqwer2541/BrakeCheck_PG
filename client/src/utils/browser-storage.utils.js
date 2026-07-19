import {
  lastPageStorageKey,
  pagePermissions
} from '../config/app.config.js';

const rememberedInstrumentCodesKey = 'brakecheck:dimension:instrument-codes:v1';
const lotInspectionLocationKey = 'brakecheck:lot-inspection-location:v1';
const rememberedInstrumentIndexes = [0, 1, 3];
const lotInspectionTabs = new Set(['dimension', 'packing']);

function normalizeLotInspectionLocation(location) {
  const lotNumber = String(location?.lotNumber || '').trim();
  const activeTab = String(location?.activeTab || '').trim();

  if (!/^[A-Za-z0-9-]{1,20}$/.test(lotNumber)
    || !lotInspectionTabs.has(activeTab)
    || typeof location?.isReadOnly !== 'boolean') {
    return null;
  }

  return {
    lotNumber,
    activeTab,
    isReadOnly: location.isReadOnly
  };
}

export function isRememberedInstrumentCodeValid(code) {
  if (code === '-') {
    return true;
  }

  return /^A-\d{2}-\d{3}$/.test(String(code || '').trim().toUpperCase());
}

export function getRememberedInstrumentCodes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(rememberedInstrumentCodesKey) || '{}');

    return rememberedInstrumentIndexes.reduce((codes, index) => {
      const code = parsed?.[index];

      if (isRememberedInstrumentCodeValid(code, index)) {
        codes[index] = code;
      }

      return codes;
    }, {});
  } catch {
    return {};
  }
}

export function rememberInstrumentCodes(instrumentCodes = []) {
  const nextCodes = { ...getRememberedInstrumentCodes() };

  rememberedInstrumentIndexes.forEach((index) => {
    const code = String(instrumentCodes[index] || '').trim().toUpperCase();

    if (isRememberedInstrumentCodeValid(code, index)) {
      nextCodes[index] = code;
    }
  });

  try {
    localStorage.setItem(rememberedInstrumentCodesKey, JSON.stringify(nextCodes));
  } catch {
    // Browser storage can be disabled; saving the form should still work.
  }
}

export function rememberLastPage(page) {
  if (!pagePermissions[page]) {
    return;
  }

  sessionStorage.setItem(lastPageStorageKey, page);
}

export function getLastPage() {
  return sessionStorage.getItem(lastPageStorageKey) || 'dashboard';
}

export function clearLastPage() {
  sessionStorage.removeItem(lastPageStorageKey);
}

export function rememberLotInspectionLocation(location) {
  const normalizedLocation = normalizeLotInspectionLocation(location);

  if (!normalizedLocation) {
    return;
  }

  try {
    sessionStorage.setItem(lotInspectionLocationKey, JSON.stringify(normalizedLocation));
  } catch {
    // Browser storage can be disabled; opening the inspection should still work.
  }
}

export function getLotInspectionLocation() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(lotInspectionLocationKey) || 'null');
    const normalizedLocation = normalizeLotInspectionLocation(parsed);

    if (!normalizedLocation) {
      sessionStorage.removeItem(lotInspectionLocationKey);
    }

    return normalizedLocation;
  } catch {
    try {
      sessionStorage.removeItem(lotInspectionLocationKey);
    } catch {
      // Ignore storage errors and fall back to the previous page.
    }

    return null;
  }
}

export function clearLotInspectionLocation() {
  try {
    sessionStorage.removeItem(lotInspectionLocationKey);
  } catch {
    // Browser storage can be disabled; leaving the inspection should still work.
  }
}
