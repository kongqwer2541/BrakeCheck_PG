import {
  lastPageStorageKey,
  pagePermissions
} from '../config/app.config.js';

const rememberedInstrumentCodesKey = 'brakecheck:dimension:instrument-codes:v1';
const rememberedInstrumentIndexes = [0, 1, 3];

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
