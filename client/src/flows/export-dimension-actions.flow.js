import { getExportDimensionPreviewKey } from '../utils/export-dimension.utils.js';

export function createExportDimensionActions({
  previewState,
  downloadExcel,
  render,
  handleAccessError,
  openLot
}) {
  const state = { exporting: false, requestId: 0 };

  function handleOpenLot(lotNumber) {
    return openLot(lotNumber);
  }

  async function handleExportExcel() {
    if (state.exporting) {
      return;
    }

    if (previewState.previewKey !== getExportDimensionPreviewKey(
      previewState.filters,
      previewState.topicNames
    )) {
      previewState.selectedLotIds = [];
      render({
        error: 'กรุณากด Preview ใหม่ก่อน Export เพราะ filter มีการเปลี่ยนแปลง',
        message: '',
        isLoading: false
      });
      return;
    }

    const requestId = state.requestId + 1;
    state.requestId = requestId;
    state.exporting = true;
    previewState.error = '';
    previewState.message = '';
    render({ error: '', message: '', isLoading: false });

    try {
      await downloadExcel({
        lotIds: previewState.selectedLotIds.map(Number),
        topicNames: previewState.topicNames
      });

      if (requestId !== state.requestId) {
        return;
      }

      state.exporting = false;
      previewState.message = 'Export Dimension Excel สำเร็จ';
      render({
        error: '',
        message: previewState.message,
        isLoading: false
      });
    } catch (error) {
      if (requestId !== state.requestId) {
        return;
      }

      state.exporting = false;

      if (handleAccessError(error, (message) => {
        render({ error: message, message: '', isLoading: false });
      })) {
        return;
      }

      render({ error: error.message, message: '', isLoading: false });
    }
  }

  function reset() {
    state.exporting = false;
    state.requestId += 1;
  }

  return {
    handleExportExcel,
    handleOpenLot,
    reset,
    state
  };
}
