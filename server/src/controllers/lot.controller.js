import {
  applyApprovalWorkflowAction,
  createManualLot,
  getApprovalQueue,
  getLotDetail,
  lookupLotsByScanCode,
  updateLot,
  voidLot
} from '../services/lot.service.js';
import {
  deleteLotAttachment,
  getLotAttachmentDownload,
  listLotAttachments,
  uploadLotAttachment
} from '../services/lot-attachment.service.js';
import {
  completeDimensionInspection,
  getDimensionInspection,
  saveDimensionInspectionDraft
} from '../services/dimension-inspection.service.js';
import {
  completePackingInspection,
  getPackingInspection,
  savePackingInspectionDraft
} from '../services/packing-inspection.service.js';

export async function createManualLotController(req, res, next) {
  try {
    const result = await createManualLot({
      input: req.body,
      user: req.user
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getLotDetailController(req, res, next) {
  try {
    const result = await getLotDetail({
      lotNumber: req.params.lotNumber
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function lookupLotsByScanCodeController(req, res, next) {
  try {
    const result = await lookupLotsByScanCode({
      scanCode: req.query?.lotPackBarcode
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getApprovalQueueController(req, res, next) {
  try {
    const result = await getApprovalQueue({
      tab: req.query.tab,
      date: req.query.date,
      search: req.query.search,
      page: req.query.page,
      pageSize: req.query.pageSize
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

function approvalActionController(action) {
  return async function handleApprovalAction(req, res, next) {
    try {
      const result = await applyApprovalWorkflowAction({
        lotNumber: req.params.lotNumber,
        action,
        reason: req.body?.reason,
        user: req.user
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}

export const approveLotController = approvalActionController('approve');
export const cancelLotApprovalController = approvalActionController('cancel_approve');
export const sendBackLotController = approvalActionController('send_back');
export const reviewNgLotController = approvalActionController('review_ng');
export const confirmNgLotController = approvalActionController('confirm_ng');

export async function listLotAttachmentsController(req, res, next) {
  try {
    const result = await listLotAttachments({
      lotNumber: req.params.lotNumber
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function uploadLotAttachmentController(req, res, next) {
  try {
    const result = await uploadLotAttachment({
      lotNumber: req.params.lotNumber,
      file: req.file,
      user: req.user
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function deleteLotAttachmentController(req, res, next) {
  try {
    const result = await deleteLotAttachment({
      lotNumber: req.params.lotNumber,
      attachmentId: req.params.attachmentId,
      user: req.user
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function downloadLotAttachmentController(req, res, next) {
  try {
    const attachment = await getLotAttachmentDownload({
      lotNumber: req.params.lotNumber,
      attachmentId: req.params.attachmentId
    });

    res.type(attachment.mimeType);
    res.download(attachment.filePath, attachment.originalName, (error) => {
      if (error && !res.headersSent) {
        next(error);
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getDimensionInspectionController(req, res, next) {
  try {
    const result = await getDimensionInspection({
      lotNumber: req.params.lotNumber
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function saveDimensionInspectionDraftController(req, res, next) {
  try {
    const result = await saveDimensionInspectionDraft({
      lotNumber: req.params.lotNumber,
      input: req.body,
      user: req.user
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function completeDimensionInspectionController(req, res, next) {
  try {
    const result = await completeDimensionInspection({
      lotNumber: req.params.lotNumber,
      input: req.body,
      user: req.user
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getPackingInspectionController(req, res, next) {
  try {
    const result = await getPackingInspection({
      lotNumber: req.params.lotNumber
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function savePackingInspectionDraftController(req, res, next) {
  try {
    const result = await savePackingInspectionDraft({
      lotNumber: req.params.lotNumber,
      input: req.body,
      user: req.user
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function completePackingInspectionController(req, res, next) {
  try {
    const result = await completePackingInspection({
      lotNumber: req.params.lotNumber,
      input: req.body,
      user: req.user
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function updateLotController(req, res, next) {
  try {
    const result = await updateLot({
      lotNumber: req.params.lotNumber,
      input: req.body,
      user: req.user
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function voidLotController(req, res, next) {
  try {
    const result = await voidLot({
      lotNumber: req.params.lotNumber,
      reason: req.body?.reason,
      user: req.user
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}
