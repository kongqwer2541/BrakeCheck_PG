import {
  createEmptyExportDimensionPreview,
  getExportableLotIds,
  getExportDimensionFilterPayload,
  getExportDimensionPreviewKey,
  normalizeExportDimensionSelectedLots
} from '../utils/export-dimension.utils.js';

const filterFieldMap = {
  exportDimensionModel: 'model',
  exportDimensionProductionStartDate: 'productionStartDate',
  exportDimensionProductionEndDate: 'productionEndDate',
  exportDimensionInspectionStartDate: 'inspectionStartDate',
  exportDimensionInspectionEndDate: 'inspectionEndDate'
};

export function createExportDimensionPreviewState(filters = {}) {
  return {
    filters: { ...filters },
    preview: createEmptyExportDimensionPreview(),
    topicNames: [],
    selectedLotIds: [],
    loading: false,
    error: '',
    message: '',
    requestId: 0,
    previewKey: ''
  };
}

export function createExportDimensionPreviewFlow({
  state,
  getPreview,
  render,
  handleAccessError
}) {
  async function loadPreview() {
    const requestId = state.requestId + 1;
    const previewKey = getExportDimensionPreviewKey(state.filters, state.topicNames);
    state.requestId = requestId;
    state.loading = true;
    state.error = '';
    state.message = '';
    render({ error: '', message: '', isLoading: true });

    try {
      const result = await getPreview(getExportDimensionFilterPayload(
        state.filters,
        state.topicNames
      ));

      if (requestId !== state.requestId) {
        return;
      }

      const items = Array.isArray(result.items) ? result.items : [];
      state.previewKey = previewKey;
      state.preview = {
        items,
        availableTopics: Array.isArray(result.availableTopics) ? result.availableTopics : [],
        topicSummary: Array.isArray(result.topicSummary) ? result.topicSummary : [],
        summary: result.summary || null
      };
      state.selectedLotIds = normalizeExportDimensionSelectedLots(
        items,
        state.selectedLotIds
      );
      state.loading = false;
      render({ error: '', isLoading: false });
    } catch (error) {
      if (requestId !== state.requestId) {
        return;
      }

      state.loading = false;
      state.error = error.message;

      if (handleAccessError(error, (message) => {
        render({ error: message, isLoading: false });
      })) {
        return;
      }

      render({ error: error.message, isLoading: false });
    }
  }

  function handleFilterChange(name, value) {
    const field = filterFieldMap[name];

    if (!field) {
      return;
    }

    state.filters = {
      ...state.filters,
      [field]: String(value || '').trim()
    };
    state.requestId += 1;
    state.loading = false;
    state.preview = createEmptyExportDimensionPreview();
    state.selectedLotIds = [];
    state.previewKey = '';
    state.message = '';
    state.error = '';
    render({ error: '', message: '', isLoading: false });
  }

  function handleTopicToggle(topicName, isChecked) {
    const cleanTopicName = String(topicName || '').trim();

    if (!cleanTopicName) {
      return;
    }

    state.topicNames = isChecked
      ? [...new Set([...state.topicNames, cleanTopicName])]
      : state.topicNames.filter((item) => item !== cleanTopicName);
    state.selectedLotIds = [];
    return loadPreview();
  }

  function handleClearTopics() {
    state.topicNames = [];
    state.selectedLotIds = [];
    return loadPreview();
  }

  function handleLotToggle(lotId, isChecked) {
    const cleanLotId = String(lotId || '').trim();

    if (!cleanLotId) {
      return;
    }

    state.selectedLotIds = isChecked
      ? [...new Set([...state.selectedLotIds, cleanLotId])]
      : state.selectedLotIds.filter((item) => item !== cleanLotId);
    render({ error: '', message: state.message, isLoading: false });
  }

  function handleSelectAllLots(isChecked) {
    state.selectedLotIds = isChecked
      ? getExportableLotIds(state.preview.items)
      : [];
    render({ error: '', message: state.message, isLoading: false });
  }

  function reset(nextFilters = {}) {
    state.filters = { ...nextFilters };
    state.preview = createEmptyExportDimensionPreview();
    state.topicNames = [];
    state.selectedLotIds = [];
    state.loading = false;
    state.error = '';
    state.message = '';
    state.requestId += 1;
    state.previewKey = '';
  }

  return {
    handleClearTopics,
    handleFilterChange,
    handleLotToggle,
    handleSelectAllLots,
    handleTopicToggle,
    loadPreview,
    reset
  };
}
