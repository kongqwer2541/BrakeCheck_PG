export const appRoutes = {
  dashboard: { action: 'dashboard' },
  users: { action: 'users' },
  importExcel: { action: 'importExcel' },
  manualLot: { action: 'manualLot' },
  barcode: { action: 'barcode' },
  approval: { action: 'approval' },
  dimension: { action: 'inspectionQueue', queueType: 'dimension' },
  packing: { action: 'inspectionQueue', queueType: 'packing' },
  export: { action: 'exportReport' },
  exportDimension: { action: 'exportDimension' },
  results: { action: 'results' },
  summary: { action: 'summary' },
  history: { action: 'history' },
  settings: { action: 'settings' }
};

export function getAppRoute(page) {
  return appRoutes[page] || null;
}
