import { requestJson } from './auth.api.js';

function sharedSummaryFilters(filters) {
  return {
    startDate: filters.startDate || '',
    endDate: filters.endDate || '',
    modelSearch: filters.modelSearch || '',
    grade: filters.grade || '',
    topicSource: filters.topicSource || 'all',
    years: Array.isArray(filters.years) ? filters.years.join(',') : ''
  };
}

export function buildSummaryQueryString(filters = {}) {
  return new URLSearchParams(sharedSummaryFilters(filters)).toString();
}

export function buildSummaryLotsQueryString(filters = {}) {
  return new URLSearchParams({
    ...sharedSummaryFilters(filters),
    view: filters.view || '',
    rankGroup: filters.rankGroup || '',
    unfinishedStatus: filters.unfinishedStatus || '',
    periodStart: filters.periodStart || '',
    periodEnd: filters.periodEnd || '',
    topicName: filters.topicName || '',
    modelName: filters.modelName || '',
    year: filters.year || '',
    page: filters.page || '',
    pageSize: filters.pageSize || ''
  }).toString();
}

export function getQualitySummary(filters = {}) {
  return requestJson(
    `/api/summary?${buildSummaryQueryString(filters)}`,
    { useAuth: true },
    {
      error: 'ไม่สามารถโหลด Summary ได้',
      invalid: 'ข้อมูล Summary จาก server ไม่ถูกต้อง'
    }
  );
}

export function getQualitySummaryLots(filters = {}) {
  return requestJson(
    `/api/summary/lots?${buildSummaryLotsQueryString(filters)}`,
    { useAuth: true },
    {
      error: 'ไม่สามารถโหลดรายการ Summary ได้',
      invalid: 'ข้อมูลรายการ Summary จาก server ไม่ถูกต้อง'
    }
  );
}
