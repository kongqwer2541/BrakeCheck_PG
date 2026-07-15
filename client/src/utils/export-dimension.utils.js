export function getExportableLotIds(items = []) {
  return items
    .filter((item) => !item.snapshotInvalid)
    .map((item) => String(item.lotId));
}

export function normalizeExportDimensionSelectedLots(items = [], selectedLotIds = []) {
  const availableIds = new Set(getExportableLotIds(items));

  return selectedLotIds
    .map((lotId) => String(lotId))
    .filter((lotId) => availableIds.has(lotId));
}

export function getExportDimensionFilterPayload(filters = {}, topicNames = []) {
  return {
    ...filters,
    topicNames
  };
}

export function getExportDimensionPreviewKey(filters = {}, topicNames = []) {
  return JSON.stringify(getExportDimensionFilterPayload(filters, topicNames));
}

export function createEmptyExportDimensionPreview() {
  return {
    items: [],
    availableTopics: [],
    topicSummary: [],
    summary: null
  };
}
