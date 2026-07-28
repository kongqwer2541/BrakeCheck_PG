import {
  changePassword,
  clearToken,
  getCurrentUser,
  getToken,
  login,
  logout,
  saveToken
} from './services/auth.api.js';
import {
  createUser,
  getUsers,
  resetUserPassword,
  updateUser
} from './services/users.api.js';
import { getDashboardData } from './services/dashboard.api.js';
import { getInspectionQueue } from './services/inspection-queues.api.js';
import { importExcelFile, previewExcelFile } from './services/excel.api.js';
import {
  getAuditHistory,
  getImportHistory,
  getLotHistory
} from './services/history.api.js';
import {
  downloadLotReportExcel,
  downloadLotReportPdf,
  getReportExportLots
} from './services/reports.api.js';
import {
  downloadExportDimensionExcel,
  getExportDimensionPreview
} from './services/export-dimension.api.js';
import {
  createExportDimensionPreviewFlow,
  createExportDimensionPreviewState
} from './flows/export-dimension-preview.flow.js';
import { createExportDimensionActions } from './flows/export-dimension-actions.flow.js';
import { getResultsLots } from './services/results.api.js';
import { getQualitySummary, getQualitySummaryLots } from './services/summary.api.js';
import {
  createInspectionTopic,
  deactivateInspectionTopic,
  getSystemSettings,
  updateInstrumentPrefixes,
  updateInspectionTopic,
  updateInspectionTopics,
  updateSamplingRules
} from './services/settings.api.js';
import {
  approveLot,
  cancelLotApproval,
  completePackingInspection,
  completeDimensionInspection,
  confirmNgLot,
  createManualLot,
  deleteLotAttachment,
  downloadLotAttachment,
  getApprovalQueue,
  getDimensionInspection,
  getLotAttachments,
  getLot,
  getPackingInspection,
  lookupLotsByScanCode,
  reviewNgLot,
  savePackingInspectionDraft,
  saveDimensionInspectionDraft,
  sendBackLot,
  uploadLotAttachment,
  updateLot,
  voidLot
} from './services/lots.api.js';
import { bindMainLayout, renderMainLayout } from './components/main-layout.js';
import { bindChangePasswordPage, renderChangePasswordPage } from './pages/change-password.page.js';
import { bindApprovalQueuePage, defaultApprovalQueuePageSize, renderApprovalQueuePage } from './pages/approval-queue.page.js';
import { bindDashboardPage, defaultDashboardPageSize, renderDashboardPage } from './pages/dashboard.page.js';
import { bindHistoryPage, renderHistoryPage } from './pages/history.page.js';
import {
  bindInspectionQueuePage,
  defaultInspectionQueuePageSize,
  renderInspectionQueuePage
} from './pages/inspection-queue.page.js';
import { bindExportDimensionPage, renderExportDimensionPage } from './pages/export-dimension.page.js';
import { bindExportReportPage, defaultExportReportPageSize, renderExportReportPage } from './pages/export-report.page.js';
import { bindImportExcelPage, renderImportExcelPage } from './pages/import-excel.page.js';
import { bindLotInspectionPage, renderLotInspectionPage } from './pages/lot-inspection.page.js';
import { bindLotLookupPage, renderLotLookupPage } from './pages/lot-lookup.page.js';
import { bindLotEditPage, renderLotEditPage } from './pages/lot-edit.page.js';
import { bindLoginPage, renderLoginPage } from './pages/login.page.js';
import { bindManualLotPage, renderManualLotPage } from './pages/manual-lot.page.js';
import { bindResultsPage, defaultResultsPageSize, renderResultsPage } from './pages/results.page.js';
import { bindSummaryPage, renderSummaryPage } from './pages/summary.page.js';
import { bindSystemSettingsPage, renderSystemSettingsPage } from './pages/system-settings.page.js';
import { bindUsersPage, renderUsersPage } from './pages/users.page.js';
import {
  permissionDeniedMessage,
  serverUnavailableMessage,
  sessionExpiredMessage
} from './config/app.config.js';
import { getAppRoute } from './app.routes.js';
import { getTodayInputValue, isValidInputDate, shiftDate } from './utils/date.utils.js';
import { canUserOpenPage } from './utils/permissions.utils.js';
import { getExcelFileKey, validateExcelFile } from './utils/excel-file.utils.js';
import {
  clearLastPage,
  clearLotInspectionLocation,
  getLastPage,
  getLotInspectionLocation,
  getRememberedInstrumentCodes,
  rememberInstrumentCodes,
  rememberLastPage,
  rememberLotInspectionLocation
} from './utils/browser-storage.utils.js';

const app = document.querySelector('#app');

let currentUser = null;
let currentMainPage = '';
let users = [];
let selectedUserId = null;
let resetUserId = null;
let dashboardStatus = 'all';
let dashboardSearch = '';
let dashboardStartDate = getTodayInputValue();
let dashboardEndDate = getTodayInputValue();
let dashboardLatestDate = '';
let dashboardHasNewerDate = false;
let dashboardPageSize = defaultDashboardPageSize;
let dashboardPage = 1;
let dashboardNotice = '';
let dashboardData = {
  stats: null,
  items: [],
  summary: null
};
let dashboardLoading = false;
let dashboardError = '';
let dashboardRequestId = 0;
let approvalQueueActiveTab = 'waiting_approve';
let approvalQueueDate = getTodayInputValue();
let approvalQueueSearch = '';
let approvalQueuePageSize = defaultApprovalQueuePageSize;
let approvalQueuePage = 1;
let approvalQueueData = {
  items: [],
  summary: null,
  badgeCount: 0
};
let approvalQueueLoading = false;
let approvalQueueError = '';
let approvalQueueRequestId = 0;
let inspectionQueueType = 'dimension';
const inspectionQueueState = {
  dimension: {
    startDate: '',
    endDate: '',
    latestDate: '',
    hasNewerDate: false,
    status: 'all',
    search: '',
    pageSize: defaultInspectionQueuePageSize,
    page: 1,
    data: { stats: null, items: [], summary: null },
    loading: false,
    error: '',
    requestId: 0
  },
  packing: {
    startDate: '',
    endDate: '',
    latestDate: '',
    hasNewerDate: false,
    status: 'all',
    search: '',
    pageSize: defaultInspectionQueuePageSize,
    page: 1,
    data: { stats: null, items: [], summary: null },
    loading: false,
    error: '',
    requestId: 0
  }
};
let exportReportActiveTab = 'approved';
let exportReportDate = getTodayInputValue();
let exportReportSearch = '';
let exportReportPageSize = defaultExportReportPageSize;
let exportReportPage = 1;
let exportReportData = {
  items: [],
  summary: null
};
let exportReportLoading = false;
let exportReportError = '';
let exportReportMessage = '';
let exportReportRequestId = 0;
let exportReportDownloadingLot = '';
let exportReportDownloadingFormat = '';
const resultsState = {
  activeTab: 'approved',
  dateMode: '',
  startDate: '',
  endDate: '',
  latestDate: '',
  hasNewerDate: false,
  search: '',
  pageSize: defaultResultsPageSize,
  page: 1,
  data: { items: [], summary: null, counts: { approved: 0, confirmedNg: 0 } },
  loading: false,
  error: '',
  requestId: 0
};
const summaryState = {
  filters: {
    startDate: '',
    endDate: '',
    modelSearch: '',
    grade: '',
    topicSource: 'all',
    years: []
  },
  data: null,
  detail: null,
  detailRequest: null,
  loading: false,
  detailLoading: false,
  error: '',
  detailError: '',
  requestId: 0,
  detailRequestId: 0
};
const exportDimensionPreviewState = createExportDimensionPreviewState(
  getDefaultExportDimensionFilters()
);
const {
  handleClearTopics: handleExportDimensionClearTopics,
  handleFilterChange: handleExportDimensionFilterChange,
  handleLotToggle: handleExportDimensionLotToggle,
  handleSelectAllLots: handleExportDimensionSelectAllLots,
  handleTopicToggle: handleExportDimensionTopicToggle,
  loadPreview: loadExportDimensionPreview,
  reset: resetExportDimensionPreview
} = createExportDimensionPreviewFlow({
  state: exportDimensionPreviewState,
  getPreview: getExportDimensionPreview,
  render: (options) => showExportDimension(options),
  handleAccessError: (error, showForbiddenMessage) => (
    handleApiAccessError(error, showForbiddenMessage)
  )
});
const {
  handleExportExcel: handleExportDimensionExcel,
  handleOpenLot: handleOpenExportDimensionLot,
  reset: resetExportDimensionActions,
  state: exportDimensionActionState
} = createExportDimensionActions({
  previewState: exportDimensionPreviewState,
  downloadExcel: downloadExportDimensionExcel,
  render: (options) => showExportDimension(options),
  handleAccessError: (error, showForbiddenMessage) => (
    handleApiAccessError(error, showForbiddenMessage)
  ),
  openLot: (lotNumber) => {
    lotInspectionReadOnly = false;
    return loadLotInspection(lotNumber, 'dimension');
  }
});
let selectedExcelFile = null;
let excelPreview = null;
let excelMessage = '';
let excelError = '';
let excelErrorDetails = null;
let excelConflictDates = [];
let excelPreviewLoading = false;
let excelSaving = false;
let excelActiveTab = 'upload';
let excelPreviewPageSize = '50';
let excelPreviewPage = 1;
let excelPreviewFileKey = '';
let excelSaveBlocked = false;
let manualLotValues = {};
let manualLotMessage = '';
let manualLotError = '';
let manualLotSaving = false;
let lotLookupSearch = '';
let lotLookupLots = [];
let lotLookupSelectedLot = null;
let lotLookupMessage = '';
let lotLookupError = '';
let lotLookupLoading = false;
let lotLookupHasSearched = false;
let lotInspectionLot = null;
let lotInspectionData = null;
let lotPackingInspectionData = null;
let lotInspectionFormConfig = [];
let lotPackingFormConfig = [];
let lotInspectionValues = null;
let lotPackingValues = null;
let lotPackingReference = null;
let lotInspectionInstrumentPrefixes = [];
let lotInspectionSamplingRules = [];
let lotInspectionMessage = '';
let lotInspectionActiveTab = 'dimension';
let lotInspectionError = '';
let lotInspectionLoading = false;
let lotInspectionSaving = false;
let lotInspectionReadOnly = false;
let lotAttachments = [];
let lotAttachmentError = '';
let lotAttachmentUploading = false;
let selectedLotNumber = '';
let lotEditLot = null;
let lotEditValues = null;
let lotEditMessage = '';
let lotEditError = '';
let lotEditLoading = false;
let lotEditSaving = false;
const historyTabs = ['lots', 'imports', 'audits'];
let historyActiveTab = 'lots';
let historyDate = '';
let historyStatus = 'all';
let historyAction = 'all';
let historySearch = '';
let historyPageSize = '50';
let historyPage = 1;
let historyData = {
  items: [],
  summary: null
};
let historyLoading = false;
let historyError = '';
let historyRequestId = 0;
let historySearchTimer = null;
let systemSettingsData = null;
let systemSettingsLoading = false;
let systemSettingsError = '';
let systemSettingsMessage = '';
let systemSettingsSaving = false;
let systemSettingsRequestId = 0;
let systemSettingsActiveTab = 'dimension';

function canOpenPage(page) {
  return canUserOpenPage(currentUser, page);
}

function getQueueState(queueType = inspectionQueueType) {
  return inspectionQueueState[queueType] || inspectionQueueState.dimension;
}

function getDefaultExportDimensionFilters() {
  return {
    model: '',
    productionStartDate: getTodayInputValue(),
    productionEndDate: getTodayInputValue(),
    inspectionStartDate: '',
    inspectionEndDate: ''
  };
}

function resetClientState() {
  currentUser = null;
  users = [];
  selectedUserId = null;
  resetUserId = null;
  dashboardStatus = 'all';
  dashboardSearch = '';
  dashboardStartDate = getTodayInputValue();
  dashboardEndDate = getTodayInputValue();
  dashboardLatestDate = '';
  dashboardHasNewerDate = false;
  dashboardPageSize = defaultDashboardPageSize;
  dashboardPage = 1;
  dashboardNotice = '';
  dashboardData = {
    stats: null,
    items: [],
    summary: null
  };
  dashboardLoading = false;
  dashboardError = '';
  approvalQueueActiveTab = 'waiting_approve';
  approvalQueueDate = getTodayInputValue();
  approvalQueueSearch = '';
  approvalQueuePageSize = defaultApprovalQueuePageSize;
  approvalQueuePage = 1;
  approvalQueueData = {
    items: [],
    summary: null,
    badgeCount: 0
  };
  approvalQueueLoading = false;
  approvalQueueError = '';
  approvalQueueRequestId = 0;
  inspectionQueueType = 'dimension';
  Object.values(inspectionQueueState).forEach((state) => {
    state.startDate = '';
    state.endDate = '';
    state.latestDate = '';
    state.hasNewerDate = false;
    state.status = 'all';
    state.search = '';
    state.pageSize = defaultInspectionQueuePageSize;
    state.page = 1;
    state.data = { stats: null, items: [], summary: null };
    state.loading = false;
    state.error = '';
    state.requestId = 0;
  });
  exportReportActiveTab = 'approved';
  exportReportDate = getTodayInputValue();
  exportReportSearch = '';
  exportReportPageSize = defaultExportReportPageSize;
  exportReportPage = 1;
  exportReportData = {
    items: [],
    summary: null
  };
  exportReportLoading = false;
  exportReportError = '';
  exportReportMessage = '';
  exportReportRequestId = 0;
  exportReportDownloadingLot = '';
  exportReportDownloadingFormat = '';
  resetExportDimensionPreview(getDefaultExportDimensionFilters());
  resetExportDimensionActions();
  selectedExcelFile = null;
  excelPreview = null;
  excelMessage = '';
  excelError = '';
  excelErrorDetails = null;
  excelConflictDates = [];
  excelPreviewLoading = false;
  excelSaving = false;
  excelActiveTab = 'upload';
  excelPreviewPageSize = '50';
  excelPreviewPage = 1;
  excelPreviewFileKey = '';
  excelSaveBlocked = false;
  manualLotValues = {};
  manualLotMessage = '';
  manualLotError = '';
  manualLotSaving = false;
  lotLookupSearch = '';
  lotLookupLots = [];
  lotLookupSelectedLot = null;
  lotLookupMessage = '';
  lotLookupError = '';
  lotLookupLoading = false;
  lotLookupHasSearched = false;
  lotInspectionLot = null;
  lotInspectionData = null;
  lotPackingInspectionData = null;
  lotInspectionFormConfig = [];
  lotPackingFormConfig = [];
  lotInspectionValues = null;
  lotPackingValues = null;
  lotPackingReference = null;
  lotInspectionInstrumentPrefixes = [];
  lotInspectionSamplingRules = [];
  lotInspectionMessage = '';
  lotInspectionActiveTab = 'dimension';
  lotInspectionError = '';
  lotAttachments = [];
  lotAttachmentError = '';
  lotAttachmentUploading = false;
  lotInspectionLoading = false;
  lotInspectionSaving = false;
  lotInspectionReadOnly = false;
  resultsState.activeTab = 'approved';
  resultsState.dateMode = '';
  resultsState.startDate = '';
  resultsState.endDate = '';
  resultsState.latestDate = '';
  resultsState.hasNewerDate = false;
  resultsState.search = '';
  resultsState.pageSize = defaultResultsPageSize;
  resultsState.page = 1;
  resultsState.data = { items: [], summary: null, counts: { approved: 0, confirmedNg: 0 } };
  resultsState.loading = false;
  resultsState.error = '';
  resultsState.requestId = 0;
  summaryState.filters = {
    startDate: '',
    endDate: '',
    modelSearch: '',
    grade: '',
    topicSource: 'all',
    years: []
  };
  summaryState.data = null;
  summaryState.detail = null;
  summaryState.detailRequest = null;
  summaryState.loading = false;
  summaryState.detailLoading = false;
  summaryState.error = '';
  summaryState.detailError = '';
  summaryState.requestId = 0;
  summaryState.detailRequestId = 0;
  selectedLotNumber = '';
  lotEditLot = null;
  lotEditValues = null;
  lotEditMessage = '';
  lotEditError = '';
  lotEditLoading = false;
  lotEditSaving = false;
  historyActiveTab = 'lots';
  historyDate = '';
  historyStatus = 'all';
  historyAction = 'all';
  historySearch = '';
  historyPageSize = '50';
  historyPage = 1;
  historyData = {
    items: [],
    summary: null
  };
  historyLoading = false;
  historyError = '';

  if (dashboardSearchTimer) {
    clearTimeout(dashboardSearchTimer);
    dashboardSearchTimer = null;
  }

  if (historySearchTimer) {
    clearTimeout(historySearchTimer);
    historySearchTimer = null;
  }
}

function handleSessionExpired(message = sessionExpiredMessage) {
  clearToken();
  clearLastPage();
  clearLotInspectionLocation();
  resetClientState();
  showLogin(message);
}

function handleApiAccessError(error, showForbiddenMessage) {
  if (error?.status === 401) {
    handleSessionExpired();
    return true;
  }

  if (error?.status === 403) {
    showForbiddenMessage(permissionDeniedMessage);
    return true;
  }

  return false;
}

async function restoreLastPage() {
  const lastPage = getLastPage();
  const savedInspection = getLotInspectionLocation();
  const inspectionParentPages = ['barcode', 'approval', 'export', 'exportDimension', 'results', 'summary', 'dimension', 'packing'];

  if (savedInspection
    && inspectionParentPages.includes(lastPage)
    && canOpenPage(lastPage)) {
    lotInspectionReadOnly = savedInspection.isReadOnly;
    await loadLotInspection(savedInspection.lotNumber, savedInspection.activeTab);
    return;
  }

  if (lastPage === 'users' && canOpenPage('users')) {
    await showUsers();
    return;
  }

  if (lastPage === 'importExcel' && canOpenPage('importExcel')) {
    showImportExcel();
    return;
  }

  if (lastPage === 'manualLot' && canOpenPage('manualLot')) {
    showManualLot();
    return;
  }

  if (lastPage === 'barcode' && canOpenPage('barcode')) {
    showLotLookup();
    return;
  }

  if (lastPage === 'approval' && canOpenPage('approval')) {
    loadApprovalQueue();
    return;
  }

  if ((lastPage === 'dimension' || lastPage === 'packing') && canOpenPage(lastPage)) {
    loadInspectionQueue(lastPage);
    return;
  }

  if (lastPage === 'export' && canOpenPage('export')) {
    loadExportReport();
    return;
  }

  if (lastPage === 'exportDimension' && canOpenPage('exportDimension')) {
    showExportDimension();
    return;
  }

  if (lastPage === 'results' && canOpenPage('results')) {
    loadResults();
    return;
  }

  if (lastPage === 'summary' && canOpenPage('summary')) {
    loadSummary();
    return;
  }

  if (lastPage === 'history' && canOpenPage('history')) {
    loadHistory();
    return;
  }

  if (lastPage === 'settings' && canOpenPage('settings')) {
    loadSystemSettings();
    return;
  }

  rememberLastPage('dashboard');
  loadDashboard();
}

function showLogin(message = '') {
  currentMainPage = '';
  app.innerHTML = renderLoginPage({ message });
  bindLoginPage({ onLogin: handleLogin });
}

function showChangePassword(message = '') {
  currentMainPage = '';
  app.innerHTML = renderChangePasswordPage({
    user: currentUser,
    message
  });
  bindChangePasswordPage({ onChangePassword: handleChangePassword });
}

function showMainPage({ activePage, pageTitle, children, bindPage }) {
  currentMainPage = activePage;
  const approvalBadgeCount = Number(
    approvalQueueData.summary
      ? approvalQueueData.badgeCount
      : ((dashboardData.stats?.waitingApproveLots || 0) + (dashboardData.stats?.ngLots || 0))
  );

  app.innerHTML = renderMainLayout({
    user: currentUser,
    activePage,
    pageTitle,
    children,
    badges: {
      approval: approvalBadgeCount || ''
    }
  });

  bindMainLayout({
    onNavigate: handleNavigate,
    onLogout: handleLogout
  });

  bindPage();
}

function showDashboard({ notice = dashboardNotice, error = dashboardError, isLoading = dashboardLoading } = {}) {
  dashboardNotice = notice;
  dashboardError = error;

  showMainPage({
    activePage: 'dashboard',
    pageTitle: 'Dashboard',
    children: renderDashboardPage({
      startDate: dashboardStartDate,
      endDate: dashboardEndDate,
      latestDate: dashboardLatestDate,
      todayDate: getTodayInputValue(),
      hasNewerDate: dashboardHasNewerDate,
      status: dashboardStatus,
      search: dashboardSearch,
      stats: dashboardData.stats,
      items: dashboardData.items,
      summary: dashboardData.summary,
      pageSize: dashboardPageSize,
      page: dashboardPage,
      isLoading,
      notice,
      error,
      tableError: error,
      userRole: currentUser?.role || ''
    }),
    bindPage: () => bindDashboardPage({
      onDateChange: handleDashboardDateChange,
      onRangeChange: handleDashboardRangeChange,
      onLatest: handleDashboardLatest,
      onStatusChange: handleDashboardStatusChange,
      onSearchChange: handleDashboardSearchChange,
      onPageSizeChange: handleDashboardPageSizeChange,
      onPageChange: handleDashboardPageChange,
      onEditLot: handleStartEditLot,
      onVoidLot: handleVoidLotFromDashboard
    })
  });
}

function showApprovalQueue({ error = approvalQueueError, isLoading = approvalQueueLoading } = {}) {
  if (!canOpenPage('approval')) {
    rememberLastPage('dashboard');
    showDashboard({ error: 'คุณไม่มีสิทธิ์เปิดหน้าตรวจและอนุมัติ' });
    return;
  }

  rememberLastPage('approval');
  showMainPage({
    activePage: 'approval',
    pageTitle: 'คิวตรวจและอนุมัติ',
    children: renderApprovalQueuePage({
      activeTab: approvalQueueActiveTab,
      selectedDate: approvalQueueDate,
      search: approvalQueueSearch,
      items: approvalQueueData.items,
      summary: approvalQueueData.summary,
      badgeCount: approvalQueueData.badgeCount,
      error,
      isLoading
    }),
    bindPage: () => bindApprovalQueuePage({
      onTabChange: handleApprovalTabChange,
      onDateChange: handleApprovalDateChange,
      onAllDatesChange: handleApprovalAllDatesChange,
      onSearchChange: handleApprovalSearchChange,
      onPageSizeChange: handleApprovalPageSizeChange,
      onPageChange: handleApprovalPageChange,
      onOpenLot: handleOpenApprovalLot
    })
  });
}

function showInspectionQueue({ queueType = inspectionQueueType, error = '', isLoading = null } = {}) {
  if (!canOpenPage(queueType)) {
    rememberLastPage('dashboard');
    showDashboard({ error: 'คุณไม่มีสิทธิ์เปิดคิวงานตรวจนี้' });
    return;
  }

  inspectionQueueType = queueType === 'packing' ? 'packing' : 'dimension';
  const state = getQueueState(inspectionQueueType);
  const loading = isLoading === null ? state.loading : isLoading;
  const pageTitle = inspectionQueueType === 'packing' ? 'ตรวจบรรจุ' : 'ตรวจมิติ';

  rememberLastPage(inspectionQueueType);
  showMainPage({
    activePage: inspectionQueueType,
    pageTitle,
    children: renderInspectionQueuePage({
      queueType: inspectionQueueType,
      startDate: state.startDate,
      endDate: state.endDate,
      latestDate: state.latestDate,
      hasNewerDate: state.hasNewerDate,
      status: state.status,
      search: state.search,
      stats: state.data.stats,
      items: state.data.items,
      summary: state.data.summary,
      pageSize: state.pageSize,
      page: state.page,
      isLoading: loading,
      error: error || state.error
    }),
    bindPage: () => bindInspectionQueuePage({
      onDateChange: handleInspectionQueueDateChange,
      onRangeChange: handleInspectionQueueRangeChange,
      onLatest: handleInspectionQueueLatest,
      onStatusChange: handleInspectionQueueStatusChange,
      onSearchChange: handleInspectionQueueSearchChange,
      onPageSizeChange: handleInspectionQueuePageSizeChange,
      onPageChange: handleInspectionQueuePageChange,
      onRefresh: handleInspectionQueueRefresh,
      onOpenLot: handleOpenInspectionQueueLot
    })
  });
}

function showResults({ error = resultsState.error, isLoading = resultsState.loading } = {}) {
  if (!canOpenPage('results')) {
    rememberLastPage('dashboard');
    showDashboard({ error: 'คุณไม่มีสิทธิ์เปิดหน้า Results' });
    return;
  }

  resultsState.error = error;
  rememberLastPage('results');
  showMainPage({
    activePage: 'results',
    pageTitle: 'Results',
    children: renderResultsPage({
      activeTab: resultsState.activeTab,
      dateMode: resultsState.dateMode,
      startDate: resultsState.startDate,
      endDate: resultsState.endDate,
      latestDate: resultsState.latestDate,
      hasNewerDate: resultsState.hasNewerDate,
      search: resultsState.search,
      items: resultsState.data.items,
      summary: resultsState.data.summary,
      counts: resultsState.data.counts,
      error,
      isLoading
    }),
    bindPage: () => bindResultsPage({
      onTabChange: handleResultsTabChange,
      onDateChange: handleResultsDateChange,
      onRangeChange: handleResultsRangeChange,
      onAllDates: handleResultsAllDates,
      onLatest: handleResultsLatest,
      onSearchChange: handleResultsSearchChange,
      onPageSizeChange: handleResultsPageSizeChange,
      onPageChange: handleResultsPageChange,
      onRefresh: handleResultsRefresh,
      onOpenLot: handleOpenResultsLot
    })
  });
}

function showSummary({ error = summaryState.error, isLoading = summaryState.loading } = {}) {
  if (!canOpenPage('summary')) {
    rememberLastPage('dashboard');
    showDashboard({ error: permissionDeniedMessage });
    return;
  }

  summaryState.error = error;
  rememberLastPage('summary');
  showMainPage({
    activePage: 'summary',
    pageTitle: 'Summary',
    children: renderSummaryPage({
      data: summaryState.data,
      isLoading,
      error,
      detail: summaryState.detail,
      detailLoading: summaryState.detailLoading
    }),
    bindPage: () => bindSummaryPage({
      onApplyFilters: handleSummaryApplyFilters,
      onRefresh: handleSummaryRefresh,
      onTopicSourceChange: handleSummaryTopicSourceChange,
      onYearsChange: handleSummaryYearsChange,
      onOpenDetails: handleSummaryOpenDetails,
      onDetailPageChange: handleSummaryDetailPageChange,
      onOpenLot: handleOpenSummaryLot
    })
  });
}

function showExportReport({ error = exportReportError, message = exportReportMessage, isLoading = exportReportLoading } = {}) {
  if (!canOpenPage('export')) {
    rememberLastPage('dashboard');
    showDashboard({ error: 'คุณไม่มีสิทธิ์เปิดหน้าส่งออก' });
    return;
  }

  exportReportError = error;
  exportReportMessage = message;
  rememberLastPage('export');
  showMainPage({
    activePage: 'export',
    pageTitle: 'ส่งออก',
    children: renderExportReportPage({
      activeTab: exportReportActiveTab,
      selectedDate: exportReportDate,
      search: exportReportSearch,
      items: exportReportData.items,
      summary: exportReportData.summary,
      error,
      message,
      isLoading,
      exportingLotNumber: exportReportDownloadingLot,
      exportingFormat: exportReportDownloadingFormat
    }),
    bindPage: () => bindExportReportPage({
      onTabChange: handleExportReportTabChange,
      onDateChange: handleExportReportDateChange,
      onAllDatesChange: handleExportReportAllDatesChange,
      onSearchChange: handleExportReportSearchChange,
      onPageSizeChange: handleExportReportPageSizeChange,
      onPageChange: handleExportReportPageChange,
      onOpenLot: handleOpenExportReportLot,
      onExportExcel: handleExportReportExcel,
      onExportPdf: handleExportReportPdf
    })
  });
}

function showExportDimension({
  error = exportDimensionPreviewState.error,
  message = exportDimensionPreviewState.message,
  isLoading = exportDimensionPreviewState.loading
} = {}) {
  if (!canOpenPage('exportDimension')) {
    rememberLastPage('dashboard');
    showDashboard({ error: 'คุณไม่มีสิทธิ์เปิดหน้า Export Dimension' });
    return;
  }

  exportDimensionPreviewState.error = error;
  exportDimensionPreviewState.message = message;
  rememberLastPage('exportDimension');
  showMainPage({
    activePage: 'exportDimension',
    pageTitle: 'Export Dimension',
    children: renderExportDimensionPage({
      filters: exportDimensionPreviewState.filters,
      preview: exportDimensionPreviewState.preview,
      selectedTopicNames: exportDimensionPreviewState.topicNames,
      selectedLotIds: exportDimensionPreviewState.selectedLotIds,
      error,
      message,
      isLoading,
      isExporting: exportDimensionActionState.exporting
    }),
    bindPage: () => bindExportDimensionPage({
      onFilterChange: handleExportDimensionFilterChange,
      onPreview: loadExportDimensionPreview,
      onTopicToggle: handleExportDimensionTopicToggle,
      onClearTopics: handleExportDimensionClearTopics,
      onLotToggle: handleExportDimensionLotToggle,
      onSelectAllLots: handleExportDimensionSelectAllLots,
      onOpenLot: handleOpenExportDimensionLot,
      onExportExcel: handleExportDimensionExcel
    })
  });
}

function showSystemSettings({
  error = systemSettingsError,
  message = systemSettingsMessage,
  isLoading = systemSettingsLoading
} = {}) {
  if (!canOpenPage('settings')) {
    rememberLastPage('dashboard');
    showDashboard({ error: 'คุณไม่มีสิทธิ์เปิดหน้าตั้งค่าระบบ' });
    return;
  }

  systemSettingsError = error;
  systemSettingsMessage = message;
  rememberLastPage('settings');
  showMainPage({
    activePage: 'settings',
    pageTitle: 'ตั้งค่าระบบ',
    children: renderSystemSettingsPage({
      settings: systemSettingsData,
      activeTab: systemSettingsActiveTab,
      error,
      message,
      isSaving: systemSettingsSaving,
      isLoading
    }),
    bindPage: () => bindSystemSettingsPage({
      activeTab: systemSettingsActiveTab,
      onTabChange: (activeTab) => {
        systemSettingsActiveTab = activeTab;
      },
      onCreateTopic: handleSystemSettingsTopicCreate,
      onUpdateTopic: handleSystemSettingsTopicUpdate,
      onUpdateTopics: handleSystemSettingsTopicsUpdate,
      onDeactivateTopic: handleSystemSettingsTopicDeactivate,
      onUpdateSamplingRules: handleSystemSettingsSamplingRulesUpdate,
      onUpdateInstrumentPrefixes: handleSystemSettingsInstrumentPrefixesUpdate
    })
  });
}

async function loadSystemSettings() {
  if (!canOpenPage('settings')) {
    rememberLastPage('dashboard');
    showDashboard({ error: 'คุณไม่มีสิทธิ์เปิดหน้าตั้งค่าระบบ' });
    return;
  }

  const requestId = ++systemSettingsRequestId;
  systemSettingsLoading = true;
  systemSettingsError = '';
  systemSettingsMessage = '';
  showSystemSettings({ isLoading: true, error: '' });

  try {
    const result = await getSystemSettings();

    if (requestId !== systemSettingsRequestId) {
      return;
    }

    systemSettingsData = result;
    systemSettingsLoading = false;
    showSystemSettings();
  } catch (error) {
    if (requestId !== systemSettingsRequestId) {
      return;
    }

    systemSettingsLoading = false;

    if (handleApiAccessError(error, (message) => {
      showDashboard({ error: message });
    })) {
      return;
    }

    systemSettingsError = error.message;
    showSystemSettings({ error: systemSettingsError });
  }
}

async function runSystemSettingsAction(action) {
  if (systemSettingsSaving) {
    return;
  }

  systemSettingsSaving = true;
  systemSettingsError = '';
  systemSettingsMessage = '';
  showSystemSettings();

  try {
    const result = await action();
    systemSettingsMessage = result?.message || 'บันทึกตั้งค่าระบบแล้ว';
    systemSettingsSaving = false;
    await loadSystemSettings();
    systemSettingsMessage = result?.message || systemSettingsMessage;
    showSystemSettings({ message: systemSettingsMessage });
  } catch (error) {
    systemSettingsSaving = false;

    if (handleApiAccessError(error, (message) => {
      showDashboard({ error: message });
    })) {
      return;
    }

    systemSettingsError = error.message;
    showSystemSettings({ error: systemSettingsError });
  }
}

function handleSystemSettingsTopicCreate(values) {
  runSystemSettingsAction(() => createInspectionTopic(values));
}

function handleSystemSettingsTopicUpdate(topicId, values) {
  runSystemSettingsAction(() => updateInspectionTopic(topicId, values));
}

function handleSystemSettingsTopicsUpdate(items = []) {
  runSystemSettingsAction(() => updateInspectionTopics(items));
}

function handleSystemSettingsTopicDeactivate(topicId, values) {
  runSystemSettingsAction(() => deactivateInspectionTopic(topicId, values));
}

function handleSystemSettingsSamplingRulesUpdate(values) {
  runSystemSettingsAction(() => updateSamplingRules(values));
}

function handleSystemSettingsInstrumentPrefixesUpdate(values) {
  runSystemSettingsAction(() => updateInstrumentPrefixes(values));
}

async function loadDashboard({ notice = dashboardNotice } = {}) {
  const requestId = dashboardRequestId + 1;
  dashboardRequestId = requestId;
  dashboardLoading = true;
  dashboardError = '';
  showDashboard({ notice, error: '', isLoading: true });

  try {
    const result = await getDashboardData({
      startDate: dashboardStartDate,
      endDate: dashboardEndDate,
      status: dashboardStatus,
      search: dashboardSearch,
      page: dashboardPage,
      pageSize: dashboardPageSize
    });

    if (requestId !== dashboardRequestId) {
      return;
    }

    dashboardData = {
      stats: result.stats,
      items: result.items,
      summary: result.summary
    };
    dashboardStartDate = result.filters?.startDate || dashboardStartDate;
    dashboardEndDate = result.filters?.endDate || dashboardEndDate;
    dashboardLatestDate = result.latestDate || dashboardLatestDate || '';
    dashboardHasNewerDate = Boolean(result.hasNewerDate);
    dashboardPage = result.summary?.page || dashboardPage;
    dashboardPageSize = String(result.summary?.pageSize || dashboardPageSize);
    dashboardLoading = false;
    showDashboard({ notice, error: '', isLoading: false });
  } catch (error) {
    if (requestId !== dashboardRequestId) {
      return;
    }

    dashboardData = {
      stats: null,
      items: [],
      summary: null
    };
    dashboardLoading = false;

    if (handleApiAccessError(error, (message) => {
      dashboardError = message;
      showDashboard({ notice, error: message, isLoading: false });
    })) {
      return;
    }

    dashboardError = error.message;
    showDashboard({ notice, error: error.message, isLoading: false });
  }
}

async function loadInspectionQueue(queueType = inspectionQueueType) {
  const selectedQueueType = queueType === 'packing' ? 'packing' : 'dimension';
  const state = getQueueState(selectedQueueType);
  const requestId = state.requestId + 1;
  state.requestId = requestId;
  state.loading = true;
  state.error = '';
  showInspectionQueue({ queueType: selectedQueueType, error: '', isLoading: true });

  try {
    const result = await getInspectionQueue({
      queueType: selectedQueueType,
      startDate: state.startDate,
      endDate: state.endDate,
      status: state.status,
      search: state.search,
      page: state.page,
      pageSize: state.pageSize
    });

    if (requestId !== state.requestId) {
      return;
    }

    state.startDate = result.filters?.startDate || '';
    state.endDate = result.filters?.endDate || '';
    state.latestDate = result.latestDate || state.latestDate || '';
    state.hasNewerDate = Boolean(result.hasNewerDate);
    state.status = result.filters?.status || state.status;
    state.search = result.filters?.search || state.search;
    state.page = result.summary?.page || state.page;
    state.pageSize = String(result.summary?.pageSize || state.pageSize);
    state.data = {
      stats: result.stats || null,
      items: Array.isArray(result.items) ? result.items : [],
      summary: result.summary || null
    };
    state.loading = false;
    showInspectionQueue({ queueType: selectedQueueType, error: '', isLoading: false });
  } catch (error) {
    if (requestId !== state.requestId) {
      return;
    }

    state.loading = false;
    state.error = error.message;
    state.data = { stats: null, items: [], summary: null };

    if (handleApiAccessError(error, (message) => {
      state.error = message;
      showInspectionQueue({ queueType: selectedQueueType, error: message, isLoading: false });
    })) {
      return;
    }

    showInspectionQueue({ queueType: selectedQueueType, error: error.message, isLoading: false });
  }
}

async function showUsers() {
  if (!canOpenPage('users')) {
    rememberLastPage('dashboard');
    showDashboard({ error: 'คุณไม่มีสิทธิ์เปิดหน้าจัดการผู้ใช้' });
    return;
  }

  try {
    const result = await getUsers();
    users = result.users;
    selectedUserId = null;
    resetUserId = null;
    rememberLastPage('users');
    showUsersPage();
  } catch (error) {
    if (handleApiAccessError(error, (message) => {
      showDashboard({ error: message });
    })) {
      return;
    }

    showDashboard({ error: error.message });
  }
}

function showUsersPage({ message = '', error = '' } = {}) {
  const selectedUser = users.find((user) => user.id === selectedUserId) || null;
  const resetUser = users.find((user) => user.id === resetUserId) || null;

  showMainPage({
    activePage: 'users',
    pageTitle: 'จัดการผู้ใช้',
    children: renderUsersPage({
      users,
      selectedUser,
      resetUser,
      message,
      error
    }),
    bindPage: () => bindUsersPage({
      onSubmitUser: handleSubmitUser,
      onEditUser: handleEditUser,
      onCancelEdit: handleCancelEdit,
      onStartResetPassword: handleStartResetPassword,
      onCancelResetPassword: handleCancelResetPassword,
      onConfirmResetPassword: handleConfirmResetPassword
    })
  });
}

function showImportExcel() {
  if (!canOpenPage('importExcel')) {
    rememberLastPage('dashboard');
    showDashboard({ error: 'คุณไม่มีสิทธิ์เปิดหน้านำเข้า Excel' });
    return;
  }

  rememberLastPage('importExcel');
  showMainPage({
    activePage: 'importExcel',
    pageTitle: 'นำเข้า Excel',
    children: renderImportExcelPage({
      selectedFileName: selectedExcelFile?.name || '',
      preview: excelPreview,
      message: excelMessage,
      error: excelError,
      errorDetails: excelErrorDetails,
      isPreviewLoading: excelPreviewLoading,
      isSaving: excelSaving,
      conflictDates: excelConflictDates,
      activeTab: excelActiveTab,
      previewPageSize: excelPreviewPageSize,
      previewPage: excelPreviewPage,
      saveBlocked: excelSaveBlocked
    }),
    bindPage: () => bindImportExcelPage({
      onFileChange: handleExcelFileChange,
      onPreview: handlePreviewExcel,
      onConfirmSave: handleConfirmExcelSave,
      onConfirmOverwrite: handleConfirmExcelOverwrite,
      onTabChange: handleImportTabChange,
      onPreviewPageSizeChange: handlePreviewPageSizeChange,
      onPreviewPageChange: handlePreviewPageChange
    })
  });
}

function showManualLot() {
  if (!canOpenPage('manualLot')) {
    rememberLastPage('dashboard');
    showDashboard({ error: 'คุณไม่มีสิทธิ์เปิดหน้าเพิ่ม Manual Lot' });
    return;
  }

  rememberLastPage('manualLot');
  showMainPage({
    activePage: 'manualLot',
    pageTitle: 'เพิ่ม Manual Lot',
    children: renderManualLotPage({
      values: manualLotValues,
      message: manualLotMessage,
      error: manualLotError,
      isSaving: manualLotSaving
    }),
    bindPage: () => bindManualLotPage({
      onSubmit: handleManualLotSubmit
    })
  });
}

function showLotLookup() {
  if (!canOpenPage('barcode')) {
    rememberLastPage('dashboard');
    showDashboard({ error: 'คุณไม่มีสิทธิ์เปิดหน้ายิงบาร์โค้ด' });
    return;
  }

  rememberLastPage('barcode');
  showMainPage({
    activePage: 'barcode',
    pageTitle: 'ยิงบาร์โค้ด',
    children: renderLotLookupPage({
      lotPackBarcode: lotLookupSearch,
      lots: lotLookupLots,
      selectedLot: lotLookupSelectedLot,
      message: lotLookupMessage,
      error: lotLookupError,
      isLoading: lotLookupLoading,
      hasSearched: lotLookupHasSearched
    }),
    bindPage: () => bindLotLookupPage({
      onSearch: handleLotLookupSearch,
      onSelectLot: handleSelectLookupLot,
      onOpenInspection: handleOpenInspectionFromLookup
    })
  });
}

function showLotInspectionPage() {
  const lastPage = getLastPage();
  const activeInspectionPage = ['approval', 'export', 'exportDimension', 'results', 'summary', 'dimension', 'packing'].includes(lastPage) ? lastPage : 'barcode';

  showMainPage({
    activePage: activeInspectionPage,
    pageTitle: 'Lot Inspection',
    children: renderLotInspectionPage({
      lot: lotInspectionLot,
      inspection: lotInspectionData,
      packingInspection: lotPackingInspectionData,
      formConfig: lotInspectionFormConfig,
      packingFormConfig: lotPackingFormConfig,
      formValues: lotInspectionValues,
      packingValues: lotPackingValues,
      packingReference: lotPackingReference,
      attachments: lotAttachments,
      attachmentError: lotAttachmentError,
      instrumentPrefixes: lotInspectionInstrumentPrefixes,
      samplingRules: lotInspectionSamplingRules,
      rememberedInstrumentCodes: getRememberedInstrumentCodes(),
      message: lotInspectionMessage,
      activeTab: lotInspectionActiveTab,
      error: lotInspectionError,
      userRole: currentUser?.role || '',
      isLoading: lotInspectionLoading,
      isSaving: lotInspectionSaving,
      isAttachmentUploading: lotAttachmentUploading,
      isReadOnly: lotInspectionReadOnly,
      backLabel: activeInspectionPage === 'summary'
        ? 'Back to Summary'
        : lotInspectionReadOnly ? 'กลับไป Results' : 'กลับไปค้นหา Lot'
    }),
    bindPage: () => bindLotInspectionPage({
      onTabChange: handleLotInspectionTabChange,
      onDraftSave: handleSaveDimensionDraft,
      onCompleteSave: handleSaveDimensionComplete,
      onPackingDraftSave: handleSavePackingDraft,
      onPackingCompleteSave: handleSavePackingComplete,
      onApprovalAction: handleApprovalAction,
      onAttachmentUpload: handleUploadLotAttachment,
      onAttachmentDelete: handleDeleteLotAttachment,
      onAttachmentDownload: handleDownloadLotAttachment,
      onFormValuesChange: handleDimensionFormValuesChange,
      onPackingValuesChange: handlePackingFormValuesChange,
      rememberedInstrumentCodes: getRememberedInstrumentCodes(),
      onBack: activeInspectionPage === 'approval'
        ? handleBackToApprovalQueue
        : activeInspectionPage === 'export'
          ? handleBackToExportReport
          : activeInspectionPage === 'exportDimension'
            ? handleBackToExportDimension
            : activeInspectionPage === 'results'
              ? handleBackToResults
              : activeInspectionPage === 'summary'
                ? handleBackToSummary
              : activeInspectionPage === 'dimension' || activeInspectionPage === 'packing'
                ? handleBackToInspectionQueue
                : handleBackToLotLookup
    })
  });
}

function showHistory({ error = historyError, isLoading = historyLoading } = {}) {
  if (!canOpenPage('history')) {
    rememberLastPage('dashboard');
    showDashboard({ error: 'คุณไม่มีสิทธิ์เปิดหน้าประวัติ' });
    return;
  }

  historyError = error;
  rememberLastPage('history');

  showMainPage({
    activePage: 'history',
    pageTitle: 'ประวัติ & NG',
    children: renderHistoryPage({
      activeTab: historyActiveTab,
      selectedDate: historyDate,
      status: historyStatus,
      action: historyAction,
      search: historySearch,
      pageSize: historyPageSize,
      page: historyPage,
      items: historyData.items,
      summary: historyData.summary,
      isLoading,
      error
    }),
    bindPage: () => bindHistoryPage({
      onTabChange: handleHistoryTabChange,
      onDateChange: handleHistoryDateChange,
      onClearDate: handleClearHistoryDate,
      onStatusChange: handleHistoryStatusChange,
      onActionChange: handleHistoryActionChange,
      onSearchChange: handleHistorySearchChange,
      onPageSizeChange: handleHistoryPageSizeChange,
      onPageChange: handleHistoryPageChange
    })
  });
}

async function loadHistory() {
  const requestId = historyRequestId + 1;
  historyRequestId = requestId;
  historyLoading = true;
  historyError = '';
  showHistory({ error: '', isLoading: true });

  try {
    let result;

    if (historyActiveTab === 'imports') {
      result = await getImportHistory({
        date: historyDate,
        search: historySearch,
        page: historyPage,
        pageSize: historyPageSize
      });
    } else if (historyActiveTab === 'audits') {
      result = await getAuditHistory({
        date: historyDate,
        action: historyAction,
        search: historySearch,
        page: historyPage,
        pageSize: historyPageSize
      });
    } else {
      result = await getLotHistory({
        date: historyDate,
        status: historyStatus,
        search: historySearch,
        page: historyPage,
        pageSize: historyPageSize
      });
    }

    if (requestId !== historyRequestId) {
      return;
    }

    historyData = {
      items: result.items || [],
      summary: result.summary || null
    };
    historyPage = result.summary?.page || historyPage;
    historyPageSize = String(result.summary?.pageSize || historyPageSize);
    historyLoading = false;
    showHistory({ error: '', isLoading: false });
  } catch (error) {
    if (requestId !== historyRequestId) {
      return;
    }

    historyData = {
      items: [],
      summary: null
    };
    historyLoading = false;

    if (handleApiAccessError(error, (message) => {
      historyError = message;
      showHistory({ error: message, isLoading: false });
    })) {
      return;
    }

    historyError = error.message;
    showHistory({ error: error.message, isLoading: false });
  }
}

function canManageLots() {
  return ['head', 'assistant'].includes(currentUser?.role);
}

function showLotEditPage() {
  if (!canManageLots()) {
    showDashboard({ error: 'คุณไม่มีสิทธิ์แก้ไขหรือ Void Lot' });
    return;
  }

  showMainPage({
    activePage: 'dashboard',
    pageTitle: 'แก้ไข / Void Lot',
    children: renderLotEditPage({
      lot: lotEditLot,
      values: lotEditValues,
      message: lotEditMessage,
      error: lotEditError,
      isLoading: lotEditLoading,
      isSaving: lotEditSaving
    }),
    bindPage: () => bindLotEditPage({
      onSubmit: handleSubmitLotEdit,
      onVoid: handleVoidLotFromEditPage,
      onBack: handleBackToDashboard
    })
  });
}

async function handleStartEditLot(lotNumber) {
  if (!canManageLots()) {
    showDashboard({ error: 'คุณไม่มีสิทธิ์แก้ไข Lot' });
    return;
  }

  selectedLotNumber = lotNumber;
  lotEditLot = null;
  lotEditValues = null;
  lotEditMessage = '';
  lotEditError = '';
  lotEditLoading = true;
  lotEditSaving = false;
  showLotEditPage();

  try {
    const result = await getLot(lotNumber);
    lotEditLot = result.lot;
    lotEditValues = {
      ...result.lot,
      editReason: ''
    };
    lotEditLoading = false;
    showLotEditPage();
  } catch (error) {
    lotEditLoading = false;

    if (handleApiAccessError(error, (message) => {
      lotEditError = message;
      showLotEditPage();
    })) {
      return;
    }

    lotEditError = error.message;
    showLotEditPage();
  }
}

async function handleLogin({ employeeCode, password }) {
  try {
    const result = await login(employeeCode, password);
    saveToken(result.token);
    currentUser = result.user;

    if (result.user.mustChangePassword) {
      showChangePassword();
      return;
    }

    rememberLastPage('dashboard');
    loadDashboard();
  } catch (error) {
    showLogin(error.message);
  }
}

async function handleChangePassword({ currentPassword, newPassword, confirmPassword }) {
  if (newPassword !== confirmPassword) {
    showChangePassword('รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน');
    return;
  }

  try {
    await changePassword(currentPassword, newPassword);
    handleSessionExpired('เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่');
  } catch (error) {
    if (handleApiAccessError(error, (message) => {
      showChangePassword(message);
    })) {
      return;
    }

    showChangePassword(error.message);
  }
}

async function handleLogout() {
  try {
    await logout();
  } catch {
    // The browser should still forget the local token even if the server is unreachable.
  }

  clearToken();
  clearLastPage();
  clearLotInspectionLocation();
  resetClientState();
  showLogin();
}

const navigationHandlers = {
  dashboard: () => {
    dashboardNotice = '';
    rememberLastPage('dashboard');
    loadDashboard({ notice: '' });
  },
  users: () => showUsers(),
  importExcel: () => showImportExcel(),
  manualLot: () => showManualLot(),
  barcode: () => showLotLookup(),
  approval: () => loadApprovalQueue(),
  inspectionQueue: ({ queueType }) => loadInspectionQueue(queueType),
  exportReport: () => loadExportReport(),
  exportDimension: () => showExportDimension(),
  results: () => loadResults(),
  summary: () => loadSummary(),
  history: () => loadHistory(),
  settings: () => loadSystemSettings()
};

function showUnknownRouteFallback() {
  showDashboard({ notice: 'เมนูนี้จะเชื่อมต่อใน Step ถัดไป' });
}

function handleNavigate(page) {
  const route = getAppRoute(page);

  if (!route) {
    showUnknownRouteFallback();
    return;
  }

  if (!canOpenPage(page)) {
    rememberLastPage('dashboard');
    showDashboard({ error: 'คุณไม่มีสิทธิ์เปิดเมนูนี้' });
    return;
  }

  const handler = navigationHandlers[route.action];

  if (handler) {
    clearLotInspectionLocation();
    handler(route);
    return;
  }

  showUnknownRouteFallback();
}

function handleDashboardDateChange(selectedDate) {
  const date = isValidInputDate(selectedDate) ? selectedDate : dashboardLatestDate || getTodayInputValue();
  dashboardStartDate = date;
  dashboardEndDate = date;
  dashboardPage = 1;
  loadDashboard();
}

function handleDashboardRangeChange(days) {
  const baseDate = dashboardEndDate || dashboardLatestDate || getTodayInputValue();
  dashboardStartDate = shiftDate(baseDate, -Math.max(0, Number(days || 0)));
  dashboardEndDate = baseDate;
  dashboardPage = 1;
  loadDashboard();
}

function handleDashboardLatest() {
  const targetDate = dashboardLatestDate || getTodayInputValue();
  dashboardStartDate = targetDate;
  dashboardEndDate = targetDate;
  dashboardPage = 1;
  loadDashboard();
}

function handleDashboardStatusChange(status) {
  dashboardStatus = status;
  dashboardPage = 1;
  loadDashboard();
}

let dashboardSearchTimer = null;

function handleDashboardSearchChange(search) {
  dashboardSearch = search;

  if (dashboardSearchTimer) {
    clearTimeout(dashboardSearchTimer);
  }

  dashboardSearchTimer = setTimeout(() => {
    dashboardPage = 1;
    loadDashboard();
  }, 300);
}

function handleDashboardPageSizeChange(pageSize) {
  dashboardPageSize = pageSize;
  dashboardPage = 1;
  loadDashboard();
}

function handleDashboardPageChange(page) {
  dashboardPage = page;
  loadDashboard();
}

function handleInspectionQueueDateChange(selectedDate) {
  const state = getQueueState();
  const date = isValidInputDate(selectedDate) ? selectedDate : state.latestDate || getTodayInputValue();
  state.startDate = date;
  state.endDate = date;
  state.page = 1;
  loadInspectionQueue();
}

function handleInspectionQueueRangeChange(days) {
  const state = getQueueState();
  const baseDate = state.endDate || state.latestDate || getTodayInputValue();
  state.startDate = shiftDate(baseDate, -Math.max(0, Number(days || 0)));
  state.endDate = baseDate;
  state.page = 1;
  loadInspectionQueue();
}

function handleInspectionQueueLatest() {
  const state = getQueueState();
  state.startDate = state.latestDate || '';
  state.endDate = state.latestDate || '';
  state.page = 1;
  loadInspectionQueue();
}

function handleInspectionQueueStatusChange(status) {
  const state = getQueueState();
  state.status = status || 'all';
  state.page = 1;
  loadInspectionQueue();
}

let inspectionQueueSearchTimer = null;

function handleInspectionQueueSearchChange(search) {
  const state = getQueueState();
  state.search = String(search || '').trim();

  if (inspectionQueueSearchTimer) {
    clearTimeout(inspectionQueueSearchTimer);
  }

  inspectionQueueSearchTimer = setTimeout(() => {
    state.page = 1;
    loadInspectionQueue();
  }, 300);
}

function handleInspectionQueuePageSizeChange(pageSize) {
  const state = getQueueState();
  state.pageSize = pageSize === 'all' ? 'all' : defaultInspectionQueuePageSize;
  state.page = 1;
  loadInspectionQueue();
}

function handleInspectionQueuePageChange(page) {
  const state = getQueueState();
  state.page = page;
  loadInspectionQueue();
}

function handleInspectionQueueRefresh() {
  loadInspectionQueue();
}

function handleOpenInspectionQueueLot(lotNumber) {
  if (!lotNumber) {
    return;
  }

  const formType = inspectionQueueType === 'packing' ? 'packing' : 'dimension';
  rememberLastPage(inspectionQueueType);
  lotInspectionReadOnly = false;
  loadLotInspection(lotNumber, formType);
}

function handleHistoryTabChange(tab) {
  historyActiveTab = historyTabs.includes(tab) ? tab : 'lots';
  historyPage = 1;
  historyError = '';
  historyData = {
    items: [],
    summary: null
  };
  loadHistory();
}

function handleHistoryDateChange(selectedDate) {
  historyDate = isValidInputDate(selectedDate) ? selectedDate : '';
  historyPage = 1;
  loadHistory();
}

function handleClearHistoryDate() {
  historyDate = '';
  historyPage = 1;
  loadHistory();
}

function handleHistoryStatusChange(status) {
  historyStatus = status;
  historyPage = 1;
  loadHistory();
}

function handleHistoryActionChange(action) {
  historyAction = action;
  historyPage = 1;
  loadHistory();
}

function handleHistorySearchChange(search) {
  historySearch = search;

  if (historySearchTimer) {
    clearTimeout(historySearchTimer);
  }

  historySearchTimer = setTimeout(() => {
    historyPage = 1;
    loadHistory();
  }, 300);
}

function handleHistoryPageSizeChange(pageSize) {
  historyPageSize = pageSize;
  historyPage = 1;
  loadHistory();
}

function handleHistoryPageChange(page) {
  historyPage = page;
  loadHistory();
}

function handleBackToDashboard() {
  selectedLotNumber = '';
  lotEditLot = null;
  lotEditValues = null;
  lotEditMessage = '';
  lotEditError = '';
  lotEditLoading = false;
  lotEditSaving = false;
  rememberLastPage('dashboard');
  loadDashboard();
}

function handleQuickAction(action) {
  if (action === 'importExcel') {
    showImportExcel();
    return;
  }

  if (action === 'barcode') {
    showLotLookup();
    return;
  }

  dashboardNotice = `เมนู ${action} จะเชื่อมต่อใน Step ถัดไป`;
  showDashboard({ notice: dashboardNotice });
}

async function loadApprovalQueue() {
  const requestId = approvalQueueRequestId + 1;
  approvalQueueRequestId = requestId;
  approvalQueueLoading = true;
  approvalQueueError = '';
  showApprovalQueue({ error: '', isLoading: true });

  try {
    const result = await getApprovalQueue({
      tab: approvalQueueActiveTab,
      date: approvalQueueDate || 'all',
      search: approvalQueueSearch,
      page: approvalQueuePage,
      pageSize: approvalQueuePageSize
    });

    if (requestId !== approvalQueueRequestId) {
      return;
    }

    approvalQueueData = {
      items: Array.isArray(result.items) ? result.items : [],
      summary: result.summary || null,
      badgeCount: Number(result.badgeCount || 0)
    };
    approvalQueueLoading = false;
    showApprovalQueue({ error: '', isLoading: false });
  } catch (error) {
    if (requestId !== approvalQueueRequestId) {
      return;
    }

    approvalQueueLoading = false;
    approvalQueueError = error.message;

    if (handleApiAccessError(error, (message) => {
      showApprovalQueue({ error: message, isLoading: false });
    })) {
      return;
    }

    showApprovalQueue({ error: error.message, isLoading: false });
  }
}

function handleApprovalTabChange(tab) {
  approvalQueueActiveTab = tab === 'ng' ? 'ng' : 'waiting_approve';
  approvalQueuePage = 1;
  loadApprovalQueue();
}

function handleApprovalDateChange(selectedDate) {
  approvalQueueDate = isValidInputDate(selectedDate) ? selectedDate : getTodayInputValue();
  approvalQueuePage = 1;
  loadApprovalQueue();
}

function handleApprovalAllDatesChange(isAllDates) {
  approvalQueueDate = isAllDates ? '' : getTodayInputValue();
  approvalQueuePage = 1;
  loadApprovalQueue();
}

function handleApprovalSearchChange(search) {
  approvalQueueSearch = String(search || '').trim();
  approvalQueuePage = 1;
  loadApprovalQueue();
}

function handleApprovalPageSizeChange(pageSize) {
  approvalQueuePageSize = pageSize === 'all' ? 'all' : defaultApprovalQueuePageSize;
  approvalQueuePage = 1;
  loadApprovalQueue();
}

function handleApprovalPageChange(page) {
  approvalQueuePage = page;
  loadApprovalQueue();
}

function handleOpenApprovalLot(lotNumber) {
  lotInspectionReadOnly = false;
  loadLotInspection(lotNumber, 'dimension');
}

async function loadResults() {
  const requestId = resultsState.requestId + 1;
  resultsState.requestId = requestId;
  resultsState.loading = true;
  resultsState.error = '';
  showResults({ error: '', isLoading: true });

  try {
    const result = await getResultsLots({
      tab: resultsState.activeTab,
      dateMode: resultsState.dateMode,
      startDate: resultsState.startDate,
      endDate: resultsState.endDate,
      search: resultsState.search,
      page: resultsState.page,
      pageSize: resultsState.pageSize
    });

    if (requestId !== resultsState.requestId) {
      return;
    }

    resultsState.latestDate = result.latestDate || '';
    resultsState.hasNewerDate = Boolean(result.hasNewerDate);
    resultsState.startDate = result.filters?.startDate || '';
    resultsState.endDate = result.filters?.endDate || '';
    resultsState.search = result.filters?.search || resultsState.search;
    resultsState.page = Number(result.filters?.page || resultsState.page || 1);
    resultsState.pageSize = result.filters?.pageSize || resultsState.pageSize;
    resultsState.data = {
      items: Array.isArray(result.items) ? result.items : [],
      summary: result.summary || null,
      counts: result.counts || { approved: 0, confirmedNg: 0 }
    };
    resultsState.loading = false;
    showResults({ error: '', isLoading: false });
  } catch (error) {
    if (requestId !== resultsState.requestId) {
      return;
    }

    resultsState.loading = false;
    resultsState.error = error.message;

    if (handleApiAccessError(error, (message) => {
      showResults({ error: message, isLoading: false });
    })) {
      return;
    }

    showResults({ error: error.message, isLoading: false });
  }
}

function handleResultsTabChange(tab) {
  resultsState.activeTab = tab === 'confirmed_ng' ? 'confirmed_ng' : 'approved';
  resultsState.page = 1;
  loadResults();
}

function handleResultsDateChange(selectedDate) {
  const date = isValidInputDate(selectedDate) ? selectedDate : resultsState.latestDate || getTodayInputValue();
  resultsState.dateMode = '';
  resultsState.startDate = date;
  resultsState.endDate = date;
  resultsState.page = 1;
  loadResults();
}

function handleResultsRangeChange(days) {
  const baseDate = resultsState.endDate || resultsState.latestDate || getTodayInputValue();
  resultsState.dateMode = '';
  resultsState.startDate = shiftDate(baseDate, -Math.max(0, Number(days || 0)));
  resultsState.endDate = baseDate;
  resultsState.page = 1;
  loadResults();
}

function handleResultsAllDates() {
  resultsState.dateMode = 'all';
  resultsState.startDate = '';
  resultsState.endDate = '';
  resultsState.page = 1;
  loadResults();
}

function handleResultsLatest() {
  resultsState.dateMode = '';
  resultsState.startDate = resultsState.latestDate || '';
  resultsState.endDate = resultsState.latestDate || '';
  resultsState.page = 1;
  loadResults();
}

let resultsSearchTimer = null;

function handleResultsSearchChange(search) {
  resultsState.search = String(search || '').trim();

  if (resultsSearchTimer) {
    clearTimeout(resultsSearchTimer);
  }

  resultsSearchTimer = setTimeout(() => {
    resultsState.page = 1;
    loadResults();
  }, 300);
}

function handleResultsPageSizeChange(pageSize) {
  resultsState.pageSize = pageSize === 'all' ? 'all' : defaultResultsPageSize;
  resultsState.page = 1;
  loadResults();
}

function handleResultsPageChange(page) {
  resultsState.page = page;
  loadResults();
}

function handleResultsRefresh() {
  loadResults();
}

function handleOpenResultsLot(lotNumber) {
  if (!lotNumber) {
    return;
  }

  rememberLastPage('results');
  lotInspectionReadOnly = true;
  loadLotInspection(lotNumber, 'dimension');
}

function getSummaryDetailTitle(view) {
  const titles = {
    final: 'Final Lots',
    approved: 'Approved Lots',
    confirmed_ng: 'Confirmed NG Lots',
    unfinished: 'Unfinished Lots',
    trend: 'Trend Lots',
    topic: 'Topic Lots',
    model: 'Model Lots',
    year: 'Yearly Lots'
  };

  return titles[view] || 'Summary Detail';
}

function createSummaryDetailRequest(request) {
  const requestedDetail = typeof request === 'string' ? { view: request } : (request || {});
  const view = requestedDetail.view === 'ng' || requestedDetail.view === 'ng-rate'
    ? 'confirmed_ng'
    : requestedDetail.view;

  if (!view) {
    return null;
  }

  const detailRequest = {
    ...summaryState.filters,
    ...requestedDetail,
    view,
    page: 1,
    pageSize: 50
  };

  if (view === 'topic' && !detailRequest.rankGroup) {
    detailRequest.rankGroup = detailRequest.topicName ? 'selected' : 'other';
  }

  if (view === 'model' && !detailRequest.rankGroup) {
    detailRequest.rankGroup = detailRequest.modelName ? 'selected' : 'other';
  }

  return detailRequest;
}

function handleSummaryApplyFilters(filters) {
  summaryState.filters = {
    ...summaryState.filters,
    ...filters,
    years: [...summaryState.filters.years]
  };
  return loadSummary();
}

function handleSummaryRefresh() {
  return loadSummary();
}

function handleSummaryTopicSourceChange(source) {
  summaryState.filters = {
    ...summaryState.filters,
    topicSource: source || 'all'
  };
  return loadSummary();
}

function handleSummaryYearsChange(years) {
  summaryState.filters = {
    ...summaryState.filters,
    years: (Array.isArray(years) ? years : [])
      .map(Number)
      .filter(Number.isFinite)
      .slice(0, 3)
  };
  return loadSummary();
}

function handleSummaryOpenDetails(request) {
  const detailRequest = createSummaryDetailRequest(request);

  if (!detailRequest) {
    return;
  }

  summaryState.detailRequest = detailRequest;
  summaryState.detail = {
    view: detailRequest.view,
    title: getSummaryDetailTitle(detailRequest.view),
    items: [],
    page: detailRequest.page,
    totalItems: 0,
    totalPages: 1,
    error: ''
  };
  return loadSummaryDetails();
}

function handleSummaryDetailPageChange(page) {
  if (!summaryState.detailRequest || !Number.isInteger(page) || page < 1) {
    return;
  }

  const totalPages = Number(summaryState.detail?.totalPages || 1);
  if (page > totalPages || page === summaryState.detailRequest.page) {
    return;
  }

  summaryState.detailRequest = {
    ...summaryState.detailRequest,
    page
  };
  return loadSummaryDetails();
}

async function loadSummary() {
  const requestId = ++summaryState.requestId;
  summaryState.detailRequestId += 1;
  summaryState.loading = true;
  summaryState.detailLoading = false;
  summaryState.error = '';
  summaryState.detailError = '';
  summaryState.detail = null;
  summaryState.detailRequest = null;
  showSummary({ error: '', isLoading: true });

  try {
    const result = await getQualitySummary(summaryState.filters);
    if (requestId !== summaryState.requestId || currentMainPage !== 'summary') return;

    summaryState.filters = {
      ...summaryState.filters,
      ...result.filters,
      years: [...result.filters.years]
    };
    summaryState.data = result;
    summaryState.detail = null;
    summaryState.loading = false;
    showSummary({ error: '', isLoading: false });
  } catch (error) {
    if (requestId !== summaryState.requestId || currentMainPage !== 'summary') return;

    summaryState.loading = false;
    summaryState.error = error.message;

    if (handleApiAccessError(error, (message) => {
      showSummary({ error: message, isLoading: false });
    })) {
      return;
    }

    showSummary({ error: error.message, isLoading: false });
  }
}

async function loadSummaryDetails() {
  if (!summaryState.detailRequest) {
    return;
  }

  const requestId = ++summaryState.detailRequestId;
  const detailRequest = { ...summaryState.detailRequest };
  summaryState.detailLoading = true;
  summaryState.detailError = '';
  summaryState.detail = {
    ...summaryState.detail,
    page: detailRequest.page,
    isLoading: true,
    error: ''
  };
  showSummary();

  try {
    const result = await getQualitySummaryLots(detailRequest);
    if (requestId !== summaryState.detailRequestId || currentMainPage !== 'summary') return;

    const detailSummary = result.summary || {};
    summaryState.detailLoading = false;
    summaryState.detail = {
      ...summaryState.detail,
      items: Array.isArray(result.items) ? result.items : [],
      page: Number(detailSummary.page || detailRequest.page || 1),
      totalItems: Number(detailSummary.total || 0),
      totalPages: Math.max(Number(detailSummary.totalPages) || 1, 1),
      isLoading: false,
      error: ''
    };
    showSummary();
  } catch (error) {
    if (requestId !== summaryState.detailRequestId || currentMainPage !== 'summary') return;

    summaryState.detailLoading = false;
    summaryState.detailError = error.message;
    summaryState.detail = {
      ...summaryState.detail,
      isLoading: false,
      error: error.message
    };

    if (handleApiAccessError(error, (message) => {
      showSummary({ error: message, isLoading: false });
    })) {
      return;
    }

    showSummary();
  }
}

function handleOpenSummaryLot(lotNumber) {
  if (!lotNumber) return;
  rememberLastPage('summary');
  lotInspectionReadOnly = true;
  return loadLotInspection(lotNumber, 'dimension');
}

async function loadExportReport() {
  const requestId = exportReportRequestId + 1;
  exportReportRequestId = requestId;
  exportReportLoading = true;
  exportReportError = '';
  exportReportMessage = '';
  showExportReport({ error: '', message: '', isLoading: true });

  try {
    const result = await getReportExportLots({
      tab: exportReportActiveTab,
      date: exportReportDate || 'all',
      search: exportReportSearch,
      page: exportReportPage,
      pageSize: exportReportPageSize
    });

    if (requestId !== exportReportRequestId) {
      return;
    }

    exportReportData = {
      items: Array.isArray(result.items) ? result.items : [],
      summary: result.summary || null
    };
    exportReportLoading = false;
    showExportReport({ error: '', isLoading: false });
  } catch (error) {
    if (requestId !== exportReportRequestId) {
      return;
    }

    exportReportLoading = false;
    exportReportError = error.message;

    if (handleApiAccessError(error, (message) => {
      showExportReport({ error: message, isLoading: false });
    })) {
      return;
    }

    showExportReport({ error: error.message, isLoading: false });
  }
}

function handleExportReportTabChange(tab) {
  exportReportActiveTab = tab === 'confirmed_ng' ? 'confirmed_ng' : 'approved';
  exportReportPage = 1;
  loadExportReport();
}

function handleExportReportDateChange(selectedDate) {
  exportReportDate = isValidInputDate(selectedDate) ? selectedDate : getTodayInputValue();
  exportReportPage = 1;
  loadExportReport();
}

function handleExportReportAllDatesChange(isAllDates) {
  exportReportDate = isAllDates ? '' : getTodayInputValue();
  exportReportPage = 1;
  loadExportReport();
}

function handleExportReportSearchChange(search) {
  exportReportSearch = String(search || '').trim();
  exportReportPage = 1;
  loadExportReport();
}

function handleExportReportPageSizeChange(pageSize) {
  exportReportPageSize = pageSize === 'all' ? 'all' : defaultExportReportPageSize;
  exportReportPage = 1;
  loadExportReport();
}

function handleExportReportPageChange(page) {
  exportReportPage = page;
  loadExportReport();
}

function handleOpenExportReportLot(lotNumber) {
  lotInspectionReadOnly = false;
  loadLotInspection(lotNumber, 'dimension');
}

async function handleExportReportDownload(lotNumber, { format, label, download }) {
  if (exportReportDownloadingLot) {
    return;
  }

  exportReportDownloadingLot = lotNumber;
  exportReportDownloadingFormat = format;
  exportReportError = '';
  exportReportMessage = '';
  showExportReport({ error: '', message: '', isLoading: false });

  try {
    await download(lotNumber);
    exportReportDownloadingLot = '';
    exportReportDownloadingFormat = '';
    exportReportMessage = `Export ${label} ${lotNumber} สำเร็จ`;
    showExportReport({ error: '', message: exportReportMessage, isLoading: false });
  } catch (error) {
    exportReportDownloadingLot = '';
    exportReportDownloadingFormat = '';

    if (handleApiAccessError(error, (message) => {
      showExportReport({ error: message, message: '', isLoading: false });
    })) {
      return;
    }

    showExportReport({ error: error.message, message: '', isLoading: false });
  }
}

function handleExportReportExcel(lotNumber) {
  return handleExportReportDownload(lotNumber, {
    format: 'excel',
    label: 'Excel',
    download: downloadLotReportExcel
  });
}

function handleExportReportPdf(lotNumber) {
  return handleExportReportDownload(lotNumber, {
    format: 'pdf',
    label: 'PDF',
    download: downloadLotReportPdf
  });
}

async function handleLotLookupSearch(lotPackBarcode) {
  if (lotLookupLoading) {
    return;
  }

  const searchText = String(lotPackBarcode || '').replace(/\s+/g, '');
  lotLookupSearch = searchText;
  lotLookupMessage = '';
  lotLookupError = '';
  lotLookupSelectedLot = null;
  lotLookupHasSearched = true;

  if (!searchText) {
    lotLookupLots = [];
    lotLookupError = 'กรุณายิงหรือกรอก Lot Pack / Lot';
    showLotLookup();
    return;
  }

  if (!/^[0-9]+$/.test(searchText)) {
    lotLookupLots = [];
    lotLookupError = 'Lot Pack หรือ Lot ต้องเป็นตัวเลขเท่านั้น';
    showLotLookup();
    return;
  }

  lotLookupLoading = true;
  showLotLookup();

  try {
    const result = await lookupLotsByScanCode(searchText);
    lotLookupLots = result.lots || [];
    lotLookupSelectedLot = lotLookupLots.length === 1 ? lotLookupLots[0] : null;
    lotLookupMessage = result.hasMore
      ? `แสดง ${result.limit} รายการแรก กรุณาตรวจ Lot Pack / Lot ให้ชัดเจนขึ้น`
      : '';

    if (!lotLookupMessage && lotLookupLots.length > 1) {
      lotLookupMessage = `พบหลาย Lot จาก ${result.matchType === 'lot' ? 'Lot' : 'Lot Pack'} กรุณาเลือก Lot ที่ต้องการตรวจ`;
    }
    lotLookupError = lotLookupLots.length ? '' : 'ไม่พบ Lot Pack / Lot นี้ในระบบ';
  } catch (error) {
    lotLookupLots = [];
    lotLookupSelectedLot = null;

    if (handleApiAccessError(error, (message) => {
      lotLookupError = message;
      showLotLookup();
    })) {
      return;
    }

    lotLookupError = error.message;
  } finally {
    lotLookupLoading = false;

    if (currentUser) {
      showLotLookup();
    }
  }
}

function handleSelectLookupLot(lotNumber) {
  lotLookupSelectedLot = lotLookupLots.find((lot) => lot.lotNumber === lotNumber) || null;
  lotLookupMessage = lotLookupSelectedLot ? `เลือก Lot ${lotLookupSelectedLot.lotNumber} แล้ว` : '';
  lotLookupError = '';
  showLotLookup();
}

function handleOpenInspectionFromLookup(formType) {
  if (!lotLookupSelectedLot) {
    lotLookupError = 'กรุณาเลือก Lot ก่อน';
    showLotLookup();
    return;
  }

  if (lotLookupSelectedLot.status === 'void') {
    lotLookupError = 'Lot นี้ถูก Void แล้ว ไม่สามารถเปิดฟอร์มตรวจต่อได้';
    lotLookupMessage = '';
    showLotLookup();
    return;
  }

  lotInspectionReadOnly = false;
  loadLotInspection(lotLookupSelectedLot.lotNumber, formType);
}

async function loadLotInspection(lotNumber, formType = 'dimension') {
  const fallbackLot = lotInspectionLot?.lotNumber === lotNumber
    ? lotInspectionLot
    : lotLookupSelectedLot?.lotNumber === lotNumber
      ? lotLookupSelectedLot
      : null;

  lotInspectionLot = null;
  lotInspectionData = null;
  lotPackingInspectionData = null;
  lotInspectionFormConfig = [];
  lotPackingFormConfig = [];
  lotInspectionValues = null;
  lotPackingValues = null;
  lotPackingReference = null;
  lotInspectionInstrumentPrefixes = [];
  lotInspectionSamplingRules = [];
  lotInspectionMessage = '';
  lotInspectionActiveTab = formType === 'packing' ? 'packing' : 'dimension';
  lotInspectionError = '';
  lotAttachments = [];
  lotAttachmentError = '';
  lotAttachmentUploading = false;
  lotInspectionLoading = true;
  showLotInspectionPage();

  try {
    const result = lotInspectionReadOnly
      ? await getDimensionInspection(lotNumber)
      : lotInspectionActiveTab === 'packing'
        ? await getPackingInspection(lotNumber)
        : await getDimensionInspection(lotNumber);

    lotInspectionLot = result.lot;
    rememberLotInspectionLocation({
      lotNumber: result.lot.lotNumber,
      activeTab: lotInspectionActiveTab,
      isReadOnly: lotInspectionReadOnly
    });

    if (lotInspectionReadOnly) {
      lotInspectionData = result.inspection;
      lotInspectionFormConfig = Array.isArray(result.formConfig) ? result.formConfig : [];
      lotInspectionInstrumentPrefixes = Array.isArray(result.instrumentPrefixes) ? result.instrumentPrefixes : [];
      lotInspectionSamplingRules = Array.isArray(result.samplingRules) ? result.samplingRules : [];
      lotInspectionValues = createDimensionFormValues(result.lot, result.inspection, lotInspectionSamplingRules);

      const packingResult = await getPackingInspection(lotNumber);
      lotPackingInspectionData = packingResult.inspection;
      lotPackingFormConfig = Array.isArray(packingResult.formConfig) ? packingResult.formConfig : [];
      lotPackingValues = createPackingFormValues(packingResult.inspection);
      lotPackingReference = packingResult.packingReference || null;
    } else if (lotInspectionActiveTab === 'packing') {
      lotPackingInspectionData = result.inspection;
      lotPackingFormConfig = Array.isArray(result.formConfig) ? result.formConfig : [];
      lotPackingValues = createPackingFormValues(result.inspection);
      lotPackingReference = result.packingReference || null;
    } else {
      lotInspectionData = result.inspection;
      lotInspectionFormConfig = Array.isArray(result.formConfig) ? result.formConfig : [];
      lotInspectionInstrumentPrefixes = Array.isArray(result.instrumentPrefixes) ? result.instrumentPrefixes : [];
      lotInspectionSamplingRules = Array.isArray(result.samplingRules) ? result.samplingRules : [];
      lotInspectionValues = createDimensionFormValues(result.lot, result.inspection, lotInspectionSamplingRules);
    }

    try {
      const attachmentResult = await getLotAttachments(lotNumber);
      lotAttachments = Array.isArray(attachmentResult.attachments) ? attachmentResult.attachments : [];
      lotAttachmentError = '';
    } catch (attachmentError) {
      lotAttachments = [];
      lotAttachmentError = attachmentError.message || 'ไม่สามารถโหลดไฟล์แนบ Lot ได้';
    }

    lotInspectionError = '';
  } catch (error) {
    if (lotInspectionActiveTab === 'packing' && fallbackLot) {
      lotInspectionLot = fallbackLot;
    }

    if (handleApiAccessError(error, (message) => {
      lotInspectionError = message;
      showLotInspectionPage();
    })) {
      return;
    }

    lotInspectionError = error.message;
  } finally {
    lotInspectionLoading = false;

    if (currentUser) {
      showLotInspectionPage();
    }
  }
}

function getConfiguredSampleCount(lot, samplingRules = []) {
  const quantity = Number(lot?.quantity || 0);
  const rule = samplingRules.find((item) => (
    quantity >= Number(item.qtyMin || 0)
    && (item.qtyMax === null || item.qtyMax === undefined || quantity <= Number(item.qtyMax))
  ));

  return Number(rule?.sampleCount || lot?.sampleCount || 0);
}

function createDimensionFormValues(lot, inspection = null, samplingRules = []) {
  const instrumentCodes = Array.isArray(inspection?.instrumentCodes)
    ? inspection.instrumentCodes
    : [];
  const piecesData = inspection?.piecesData || { topics: [] };

  return {
    inspectionDate: inspection?.inspectionDate || getTodayInputValue(),
    shift: inspection?.shift || '',
    instrumentCodes: Array.from({ length: 5 }, (_, index) => instrumentCodes[index] || ''),
    rivetNo: inspection?.rivetNo || lot?.rivetNo || '',
    productionCode: inspection?.productionCode || '',
    brakeType: inspection?.brakeType || '',
    brakeModel: inspection?.brakeModel || '',
    rivetHoleThickness: inspection?.rivetHoleThickness ?? '',
    sampleCount: inspection?.sampleCount || getConfiguredSampleCount(lot, samplingRules),
    inspectionNote: piecesData?.meta?.inspectionNote || '',
    piecesData
  };
}

function createPackingFormValues(inspection = null) {
  const resultsData = inspection?.resultsData || { topics: [] };

  return {
    inspectionNote: resultsData?.meta?.inspectionNote || '',
    resultsData
  };
}

async function handleSaveDimensionDraft(values) {
  if (lotInspectionReadOnly || lotInspectionSaving || !lotInspectionLot?.lotNumber) {
    return;
  }

  lotInspectionSaving = true;
  lotInspectionMessage = '';
  lotInspectionError = '';
  lotInspectionValues = values;
  showLotInspectionPage();

  try {
    const result = await saveDimensionInspectionDraft(lotInspectionLot.lotNumber, {
      ...values,
      sampleCount: Number(values.sampleCount || lotInspectionLot.sampleCount || 0),
      formConfigSnapshot: lotInspectionFormConfig,
      piecesData: values.piecesData || { topics: [] }
    });

    lotInspectionLot = result.lot;
    lotInspectionData = result.inspection;
    rememberInstrumentCodes(values.instrumentCodes);
    lotInspectionValues = createDimensionFormValues(result.lot, result.inspection);
    lotInspectionMessage = result.message || 'บันทึกชั่วคราวแล้ว';
  } catch (error) {
    if (handleApiAccessError(error, (message) => {
      lotInspectionError = message;
      showLotInspectionPage();
    })) {
      return;
    }

    lotInspectionError = error.message;
  } finally {
    lotInspectionSaving = false;

    if (currentUser) {
      showLotInspectionPage();
    }
  }
}

function handleDimensionFormValuesChange(values) {
  lotInspectionValues = {
    ...lotInspectionValues,
    ...values
  };
  lotInspectionMessage = '';
  lotInspectionError = '';
  showLotInspectionPage();
}

function handlePackingFormValuesChange(values, options = {}) {
  lotPackingValues = {
    ...lotPackingValues,
    ...values
  };
  lotInspectionMessage = '';
  lotInspectionError = '';

  if (options.render === false) {
    return;
  }

  showLotInspectionPage();
}

async function handleSavePackingDraft(values) {
  if (lotInspectionReadOnly || lotInspectionSaving || !lotInspectionLot?.lotNumber) {
    return;
  }

  lotInspectionSaving = true;
  lotInspectionMessage = '';
  lotInspectionError = '';
  lotPackingValues = values;
  showLotInspectionPage();

  try {
    const result = await savePackingInspectionDraft(lotInspectionLot.lotNumber, {
      resultsData: values.resultsData || { topics: [] }
    });

    lotInspectionLot = result.lot;
    lotPackingInspectionData = result.inspection;
    lotPackingValues = createPackingFormValues(result.inspection);
    lotPackingReference = result.packingReference || lotPackingReference;
    lotInspectionMessage = result.message || 'บันทึกฟอร์มตรวจบรรจุชั่วคราวแล้ว';
  } catch (error) {
    if (handleApiAccessError(error, (message) => {
      lotInspectionError = message;
      showLotInspectionPage();
    })) {
      return;
    }

    lotInspectionError = error.message;
  } finally {
    lotInspectionSaving = false;

    if (currentUser) {
      showLotInspectionPage();
    }
  }
}

async function handleSaveDimensionComplete(values) {
  if (lotInspectionReadOnly || lotInspectionSaving || !lotInspectionLot?.lotNumber) {
    return;
  }

  lotInspectionSaving = true;
  lotInspectionMessage = '';
  lotInspectionError = '';
  lotInspectionValues = values;
  showLotInspectionPage();

  try {
    const result = await completeDimensionInspection(lotInspectionLot.lotNumber, {
      ...values,
      sampleCount: Number(values.sampleCount || lotInspectionLot.sampleCount || 0),
      piecesData: values.piecesData || { topics: [] }
    });

    lotInspectionLot = result.lot;
    lotInspectionData = result.inspection;
    rememberInstrumentCodes(values.instrumentCodes);
    lotInspectionValues = createDimensionFormValues(result.lot, result.inspection);
    lotInspectionMessage = result.message || 'บันทึกฟอร์มตรวจมิติสมบูรณ์แล้ว';
  } catch (error) {
    if (handleApiAccessError(error, (message) => {
      lotInspectionError = message;
      showLotInspectionPage();
    })) {
      return;
    }

    lotInspectionError = error.message;
  } finally {
    lotInspectionSaving = false;

    if (currentUser) {
      showLotInspectionPage();
    }
  }
}

async function handleSavePackingComplete(values) {
  if (lotInspectionReadOnly || lotInspectionSaving || !lotInspectionLot?.lotNumber) {
    return;
  }

  lotInspectionSaving = true;
  lotInspectionMessage = '';
  lotInspectionError = '';
  lotPackingValues = values;
  showLotInspectionPage();

  try {
    const result = await completePackingInspection(lotInspectionLot.lotNumber, {
      resultsData: values.resultsData || { topics: [] }
    });

    lotInspectionLot = result.lot;
    lotPackingInspectionData = result.inspection;
    lotPackingValues = createPackingFormValues(result.inspection);
    lotPackingReference = result.packingReference || lotPackingReference;
    lotInspectionMessage = result.message || 'บันทึกฟอร์มตรวจบรรจุสมบูรณ์แล้ว';
  } catch (error) {
    if (handleApiAccessError(error, (message) => {
      lotInspectionError = message;
      showLotInspectionPage();
    })) {
      return;
    }

    lotInspectionError = error.message;
  } finally {
    lotInspectionSaving = false;

    if (currentUser) {
      showLotInspectionPage();
    }
  }
}

function handleLotInspectionTabChange(tab) {
  const nextTab = tab === 'packing' ? 'packing' : 'dimension';

  if (lotInspectionLot?.lotNumber && nextTab !== lotInspectionActiveTab) {
    loadLotInspection(lotInspectionLot.lotNumber, nextTab);
    return;
  }

  lotInspectionActiveTab = nextTab;
  showLotInspectionPage();
}

function resetLotInspectionState() {
  lotInspectionLot = null;
  lotInspectionData = null;
  lotPackingInspectionData = null;
  lotInspectionFormConfig = [];
  lotPackingFormConfig = [];
  lotInspectionValues = null;
  lotPackingValues = null;
  lotPackingReference = null;
  lotInspectionMessage = '';
  lotInspectionActiveTab = 'dimension';
  lotInspectionError = '';
  lotInspectionLoading = false;
  lotInspectionSaving = false;
  lotInspectionReadOnly = false;
  lotAttachments = [];
  lotAttachmentError = '';
  lotAttachmentUploading = false;
}

function handleBackToLotLookup() {
  clearLotInspectionLocation();
  resetLotInspectionState();
  showLotLookup();
}

function handleBackToApprovalQueue() {
  clearLotInspectionLocation();
  resetLotInspectionState();
  loadApprovalQueue();
}

function handleBackToExportReport() {
  clearLotInspectionLocation();
  resetLotInspectionState();
  loadExportReport();
}

function handleBackToExportDimension() {
  clearLotInspectionLocation();
  resetLotInspectionState();
  showExportDimension();
}

function handleBackToResults() {
  clearLotInspectionLocation();
  resetLotInspectionState();
  loadResults();
}

function handleBackToSummary() {
  clearLotInspectionLocation();
  resetLotInspectionState();
  loadSummary();
}

function handleBackToInspectionQueue() {
  const targetQueue = getLastPage() === 'packing' ? 'packing' : 'dimension';
  clearLotInspectionLocation();
  resetLotInspectionState();
  loadInspectionQueue(targetQueue);
}

async function handleApprovalAction(action, reason = '') {
  if (lotInspectionReadOnly || lotInspectionSaving || !lotInspectionLot?.lotNumber) {
    return;
  }

  lotInspectionSaving = true;
  lotInspectionError = '';
  showLotInspectionPage();

  try {
    const lotNumber = lotInspectionLot.lotNumber;
    const actions = {
      approve: () => approveLot(lotNumber),
      cancel_approve: () => cancelLotApproval(lotNumber, reason),
      send_back: () => sendBackLot(lotNumber, reason),
      review_ng: () => reviewNgLot(lotNumber, reason),
      confirm_ng: () => confirmNgLot(lotNumber)
    };

    if (!actions[action]) {
      lotInspectionSaving = false;
      lotInspectionError = 'คำสั่งตรวจและอนุมัติไม่ถูกต้อง';
      showLotInspectionPage();
      return;
    }

    const result = await actions[action]();
    const successMessage = result.message || 'บันทึกสถานะสำเร็จ';
    await loadLotInspection(lotNumber, lotInspectionActiveTab);
    lotInspectionMessage = successMessage;
    lotInspectionSaving = false;
    showLotInspectionPage();
  } catch (error) {
    lotInspectionSaving = false;

    if (handleApiAccessError(error, (message) => {
      lotInspectionError = message;
      showLotInspectionPage();
    })) {
      return;
    }

    lotInspectionError = error.message;
    showLotInspectionPage();
  }
}

async function handleUploadLotAttachment(file) {
  if (lotInspectionReadOnly || lotAttachmentUploading || !lotInspectionLot?.lotNumber) {
    return;
  }

  if (!file) {
    lotAttachmentError = 'กรุณาเลือกไฟล์แนบ';
    lotInspectionMessage = '';
    showLotInspectionPage();
    window.setTimeout(() => {
      document.querySelector('[data-attachment-file]')?.focus();
    }, 0);
    return;
  }

  lotAttachmentUploading = true;
  lotAttachmentError = '';
  lotInspectionMessage = '';
  showLotInspectionPage();

  try {
    const result = await uploadLotAttachment(lotInspectionLot.lotNumber, file);
    lotAttachments = Array.isArray(result.attachments) ? result.attachments : [];
    lotInspectionMessage = 'แนบไฟล์ Lot สำเร็จ';
  } catch (error) {
    if (handleApiAccessError(error, (message) => {
      lotAttachmentError = message;
      showLotInspectionPage();
    })) {
      return;
    }

    lotAttachmentError = error.message;
  } finally {
    lotAttachmentUploading = false;

    if (currentUser) {
      showLotInspectionPage();
    }
  }
}

async function handleDeleteLotAttachment(attachmentId) {
  if (lotInspectionReadOnly || lotAttachmentUploading || !lotInspectionLot?.lotNumber) {
    return;
  }

  lotAttachmentUploading = true;
  lotAttachmentError = '';
  lotInspectionMessage = '';
  showLotInspectionPage();

  try {
    const result = await deleteLotAttachment(lotInspectionLot.lotNumber, attachmentId);
    lotAttachments = Array.isArray(result.attachments) ? result.attachments : [];
    lotInspectionMessage = 'ลบไฟล์แนบ Lot สำเร็จ';
  } catch (error) {
    if (handleApiAccessError(error, (message) => {
      lotAttachmentError = message;
      showLotInspectionPage();
    })) {
      return;
    }

    lotAttachmentError = error.message;
  } finally {
    lotAttachmentUploading = false;

    if (currentUser) {
      showLotInspectionPage();
    }
  }
}

async function handleDownloadLotAttachment(attachmentId, originalName) {
  if (!lotInspectionLot?.lotNumber) {
    return;
  }

  lotAttachmentError = '';

  try {
    await downloadLotAttachment(lotInspectionLot.lotNumber, attachmentId, originalName);
  } catch (error) {
    if (handleApiAccessError(error, (message) => {
      lotAttachmentError = message;
      showLotInspectionPage();
    })) {
      return;
    }

    lotAttachmentError = error.message;
    showLotInspectionPage();
  }
}

async function handleSubmitLotEdit(values) {
  if (lotEditSaving || !selectedLotNumber) {
    return;
  }

  lotEditValues = values;
  lotEditMessage = '';
  lotEditError = '';

  const confirmed = window.confirm(
    `ยืนยันบันทึกการแก้ไข Lot ${selectedLotNumber} ใช่ไหม?\nระบบจะเก็บประวัติและเหตุผลการแก้ไขไว้ตรวจสอบย้อนหลัง`
  );

  if (!confirmed) {
    showLotEditPage();
    return;
  }

  lotEditSaving = true;
  showLotEditPage();

  try {
    const result = await updateLot(selectedLotNumber, values);
    lotEditLot = result.lot;
    lotEditValues = {
      ...result.lot,
      editReason: ''
    };
    lotEditMessage = result.message || 'บันทึกการแก้ไข Lot สำเร็จ';
    lotEditError = '';
    lotEditSaving = false;
    showLotEditPage();
  } catch (error) {
    lotEditSaving = false;

    if (handleApiAccessError(error, (message) => {
      lotEditError = message;
      showLotEditPage();
    })) {
      return;
    }

    lotEditError = error.message;
    showLotEditPage();
  }
}

async function handleVoidLot(lotNumber, reason, onError) {
  if (!canManageLots()) {
    onError('คุณไม่มีสิทธิ์ Void Lot');
    return;
  }

  const trimmedReason = String(reason || '').trim();
  if (!trimmedReason) {
    onError('กรุณากรอกเหตุผลการ Void');
    return;
  }

  const confirmed = window.confirm(
    `ยืนยัน Void Lot ${lotNumber} ใช่ไหม?\nรายการนี้จะไม่ถูกลบ แต่จะถูกเปลี่ยนสถานะเป็น Void`
  );

  if (!confirmed) {
    return;
  }

  const result = await voidLot(lotNumber, trimmedReason);
  return result;
}

async function handleVoidLotFromEditPage(reason) {
  if (lotEditSaving || !selectedLotNumber) {
    return;
  }

  lotEditSaving = true;
  lotEditMessage = '';
  lotEditError = '';
  showLotEditPage();

  try {
    const result = await handleVoidLot(selectedLotNumber, reason, (message) => {
      lotEditError = message;
    });

    if (!result) {
      lotEditSaving = false;
      showLotEditPage();
      return;
    }

    lotEditLot = result.lot;
    lotEditValues = {
      ...result.lot,
      editReason: ''
    };
    lotEditMessage = result.message || 'Void Lot สำเร็จ';
    lotEditError = '';
    lotEditSaving = false;
    showLotEditPage();
  } catch (error) {
    lotEditSaving = false;

    if (handleApiAccessError(error, (message) => {
      lotEditError = message;
      showLotEditPage();
    })) {
      return;
    }

    lotEditError = error.message;
    showLotEditPage();
  }
}

async function handleVoidLotFromDashboard(lotNumber) {
  const reason = window.prompt(`กรอกเหตุผลการ Void Lot ${lotNumber}`);
  if (reason === null) {
    return;
  }

  try {
    const result = await handleVoidLot(lotNumber, reason, (message) => {
      dashboardError = message;
      showDashboard({ error: message });
    });

    if (!result) {
      return;
    }

    loadDashboard({ notice: result.message || 'Void Lot สำเร็จ' });
  } catch (error) {
    if (handleApiAccessError(error, (message) => {
      dashboardError = message;
      showDashboard({ error: message });
    })) {
      return;
    }

    dashboardError = error.message;
    showDashboard({ error: error.message });
  }
}

async function handleManualLotSubmit(values) {
  if (manualLotSaving) {
    return;
  }

  manualLotValues = values;
  manualLotMessage = '';
  manualLotError = '';

  const confirmed = window.confirm(
    `ยืนยันบันทึก Manual Lot ${values.lotNumber || ''} ใช่ไหม?\nกรุณาตรวจสอบ Lot, Lot Pack, วันฝน และจำนวนชิ้นก่อนบันทึก`
  );

  if (!confirmed) {
    showManualLot();
    return;
  }

  manualLotSaving = true;
  showManualLot();

  try {
    const result = await createManualLot(values);
    manualLotValues = {};
    manualLotMessage = result.message || 'เพิ่ม Manual Lot สำเร็จ';
    manualLotError = '';
    manualLotSaving = false;
    showManualLot();
  } catch (error) {
    manualLotSaving = false;

    if (handleApiAccessError(error, (message) => {
      manualLotError = message;
      showManualLot();
    })) {
      return;
    }

    manualLotError = error.message;
    showManualLot();
  }
}

function handleExcelFileChange(file) {
  if (excelPreviewLoading || excelSaving) {
    return;
  }

  selectedExcelFile = file;
  excelPreview = null;
  excelMessage = '';
  excelConflictDates = [];
  excelErrorDetails = null;
  excelPreviewLoading = false;
  excelSaving = false;
  excelActiveTab = 'upload';
  excelPreviewPage = 1;
  excelPreviewFileKey = '';
  excelSaveBlocked = false;
  excelError = file ? validateExcelFile(file) : '';

  showImportExcel();
}

async function handlePreviewExcel() {
  const validationError = validateExcelFile(selectedExcelFile);
  if (validationError) {
    excelError = validationError;
    showImportExcel();
    return;
  }

  const fileToPreview = selectedExcelFile;
  const fileKey = getExcelFileKey(fileToPreview);
  excelPreviewLoading = true;
  excelSaving = false;
  excelMessage = '';
  excelError = '';
  excelErrorDetails = null;
  excelConflictDates = [];
  excelPreviewPage = 1;
  excelSaveBlocked = false;
  showImportExcel();

  try {
    const previewResult = await previewExcelFile(fileToPreview);

    if (fileKey !== getExcelFileKey(selectedExcelFile)) {
      return;
    }

    excelPreview = previewResult;
    excelPreviewFileKey = fileKey;
    excelActiveTab = 'preview';
    excelMessage = 'Preview สำเร็จ กรุณาตรวจสอบข้อมูลก่อนกด Confirm Save';
  } catch (error) {
    if (fileKey !== getExcelFileKey(selectedExcelFile)) {
      return;
    }

    excelPreview = null;
    excelPreviewFileKey = '';

    if (handleApiAccessError(error, (message) => {
      excelError = message;
    })) {
      return;
    }

    excelError = error.message;
    excelErrorDetails = error.details || null;
  } finally {
    if (currentUser && fileKey === getExcelFileKey(selectedExcelFile)) {
      excelPreviewLoading = false;
      showImportExcel();
    }
  }
}

function getConflictDatesFromError(error) {
  return Array.isArray(error.details?.productionDates)
    ? error.details.productionDates
    : [];
}

async function saveExcelWithConfirmation(confirmedProductionDates = []) {
  if (excelSaving) {
    return;
  }

  if (!selectedExcelFile || !excelPreview) {
    excelError = 'กรุณา Preview ไฟล์ก่อนบันทึก';
    showImportExcel();
    return;
  }

  if (getExcelFileKey(selectedExcelFile) !== excelPreviewFileKey) {
    excelError = 'ไฟล์ที่เลือกไม่ตรงกับข้อมูล Preview กรุณากด Preview ใหม่อีกครั้ง';
    excelActiveTab = 'upload';
    showImportExcel();
    return;
  }

  excelSaving = true;
  excelMessage = '';
  excelError = '';
  excelErrorDetails = null;
  showImportExcel();

  try {
    const result = await importExcelFile(selectedExcelFile, confirmedProductionDates);
    excelPreview = null;
    selectedExcelFile = null;
    excelConflictDates = [];
    excelPreviewFileKey = '';
    excelSaveBlocked = false;
    excelActiveTab = 'upload';
    excelMessage = result.message || 'บันทึกข้อมูล Excel สำเร็จ';
  } catch (error) {
    if (handleApiAccessError(error, (message) => {
      excelConflictDates = [];
      excelError = message;
      excelErrorDetails = null;
      excelSaveBlocked = false;
    })) {
      return;
    }

    const conflictDates = getConflictDatesFromError(error);

    if (error.status === 409 && conflictDates.length) {
      excelConflictDates = conflictDates;
      excelError = 'พบข้อมูลวันฝนเดิมในระบบ กรุณาตรวจสอบและยืนยันก่อนบันทึกเพิ่ม';
      excelErrorDetails = null;
      excelSaveBlocked = false;
    } else {
      excelConflictDates = [];
      excelError = error.message;
      excelErrorDetails = error.details || null;
      excelSaveBlocked = error.status === 400 || error.status === 409;
    }
  } finally {
    excelSaving = false;

    if (currentUser) {
      showImportExcel();
    }
  }
}

function handleConfirmExcelSave() {
  saveExcelWithConfirmation();
}

function handleConfirmExcelOverwrite() {
  const confirmedDates = excelConflictDates
    .map((item) => item.productionDate)
    .filter(Boolean);

  saveExcelWithConfirmation(confirmedDates);
}

function handleImportTabChange(tab) {
  excelActiveTab = tab;
  showImportExcel();
}

function handlePreviewPageSizeChange(pageSize) {
  excelPreviewPageSize = pageSize;
  excelPreviewPage = 1;
  showImportExcel();
}

function handlePreviewPageChange(page) {
  excelPreviewPage = page;
  showImportExcel();
}

function handleEditUser(userId) {
  selectedUserId = userId;
  resetUserId = null;
  showUsersPage();
}

function handleCancelEdit() {
  selectedUserId = null;
  showUsersPage();
}

async function handleSubmitUser(user) {
  try {
    if (user.userId) {
      await updateUser(user.userId, {
        fullName: user.fullName,
        position: user.position,
        role: user.role,
        status: user.status
      });
    } else {
      await createUser(user);
    }

    const result = await getUsers();
    users = result.users;
    selectedUserId = null;
    resetUserId = null;
    showUsersPage({ message: user.userId ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มผู้ใช้ใหม่แล้ว' });
  } catch (error) {
    if (handleApiAccessError(error, (message) => {
      showUsersPage({ error: message });
    })) {
      return;
    }

    showUsersPage({ error: error.message });
  }
}

function handleStartResetPassword(userId) {
  selectedUserId = null;
  resetUserId = userId;
  showUsersPage();
}

function handleCancelResetPassword() {
  resetUserId = null;
  showUsersPage();
}

async function handleConfirmResetPassword({ temporaryPassword, confirmTemporaryPassword }) {
  if (!resetUserId) {
    showUsersPage({ error: 'กรุณาเลือกผู้ใช้ที่ต้องการ Reset Password' });
    return;
  }

  if (temporaryPassword !== confirmTemporaryPassword) {
    showUsersPage({ error: 'รหัสผ่านชั่วคราวและช่องยืนยันไม่ตรงกัน' });
    return;
  }

  try {
    await resetUserPassword(resetUserId, temporaryPassword);
    const result = await getUsers();
    users = result.users;
    selectedUserId = null;
    resetUserId = null;
    showUsersPage({ message: 'รีเซ็ตรหัสผ่านแล้ว ผู้ใช้ต้องเปลี่ยนรหัสผ่านตอน Login ครั้งถัดไป' });
  } catch (error) {
    if (handleApiAccessError(error, (message) => {
      showUsersPage({ error: message });
    })) {
      return;
    }

    showUsersPage({ error: error.message });
  }
}

async function restoreSession() {
  if (!getToken()) {
    showLogin();
    return;
  }

  try {
    const result = await getCurrentUser();
    currentUser = result.user;

    if (result.user.mustChangePassword) {
      showChangePassword();
      return;
    }

    await restoreLastPage();
  } catch (error) {
    if (error?.status === 401) {
      handleSessionExpired();
      return;
    }

    showLogin(error?.message || serverUnavailableMessage);
  }
}

export function renderApp() {
  app.innerHTML = `
    <main class="auth-shell">
      <section class="auth-panel">
        <p class="alert">กำลังโหลด BrakeCheck...</p>
      </section>
    </main>
  `;

  restoreSession().catch((error) => {
    showLogin(error?.message || serverUnavailableMessage);
  });
}
