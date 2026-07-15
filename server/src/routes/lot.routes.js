import { Router } from 'express';
import multer from 'multer';
import {
  approveLotController,
  cancelLotApprovalController,
  confirmNgLotController,
  completeDimensionInspectionController,
  completePackingInspectionController,
  createManualLotController,
  deleteLotAttachmentController,
  downloadLotAttachmentController,
  getApprovalQueueController,
  getDimensionInspectionController,
  listLotAttachmentsController,
  getLotDetailController,
  getPackingInspectionController,
  lookupLotsByScanCodeController,
  reviewNgLotController,
  savePackingInspectionDraftController,
  saveDimensionInspectionDraftController,
  sendBackLotController,
  uploadLotAttachmentController,
  updateLotController,
  voidLotController
} from '../controllers/lot.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

export const lotRouter = Router();
const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  }
});

function handleAttachmentUpload(req, res, next) {
  attachmentUpload.single('attachmentFile')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    error.statusCode = 400;
    error.message = error.code === 'LIMIT_FILE_SIZE'
      ? 'ขนาดไฟล์แนบต้องไม่เกิน 5MB'
      : 'อัปโหลดไฟล์แนบไม่สำเร็จ';
    next(error);
  });
}

lotRouter.use(requireAuth);

lotRouter.get(
  '/lookup/by-lot-pack',
  requireRole(['head', 'assistant', 'officer']),
  lookupLotsByScanCodeController
);
lotRouter.get('/approval-queue', requireRole(['head', 'assistant']), getApprovalQueueController);
lotRouter.post('/manual', requireRole(['head', 'assistant']), createManualLotController);
lotRouter.get(
  '/:lotNumber/attachments',
  requireRole(['head', 'assistant', 'officer']),
  listLotAttachmentsController
);
lotRouter.post(
  '/:lotNumber/attachments',
  requireRole(['head', 'assistant', 'officer']),
  handleAttachmentUpload,
  uploadLotAttachmentController
);
lotRouter.get(
  '/:lotNumber/attachments/:attachmentId/download',
  requireRole(['head', 'assistant', 'officer']),
  downloadLotAttachmentController
);
lotRouter.delete(
  '/:lotNumber/attachments/:attachmentId',
  requireRole(['head', 'assistant']),
  deleteLotAttachmentController
);
lotRouter.get(
  '/:lotNumber/dimension-inspection',
  requireRole(['head', 'assistant', 'officer']),
  getDimensionInspectionController
);
lotRouter.post(
  '/:lotNumber/dimension-inspection/draft',
  requireRole(['head', 'assistant', 'officer']),
  saveDimensionInspectionDraftController
);
lotRouter.post(
  '/:lotNumber/dimension-inspection/complete',
  requireRole(['head', 'assistant', 'officer']),
  completeDimensionInspectionController
);
lotRouter.get(
  '/:lotNumber/packing-inspection',
  requireRole(['head', 'assistant', 'officer']),
  getPackingInspectionController
);
lotRouter.post(
  '/:lotNumber/packing-inspection/draft',
  requireRole(['head', 'assistant', 'officer']),
  savePackingInspectionDraftController
);
lotRouter.post(
  '/:lotNumber/packing-inspection/complete',
  requireRole(['head', 'assistant', 'officer']),
  completePackingInspectionController
);
lotRouter.get('/:lotNumber', requireRole(['head', 'assistant']), getLotDetailController);
lotRouter.put('/:lotNumber', requireRole(['head', 'assistant']), updateLotController);
lotRouter.post('/:lotNumber/void', requireRole(['head', 'assistant']), voidLotController);
lotRouter.post('/:lotNumber/approve', requireRole(['head', 'assistant']), approveLotController);
lotRouter.post('/:lotNumber/cancel-approval', requireRole(['head', 'assistant']), cancelLotApprovalController);
lotRouter.post('/:lotNumber/send-back', requireRole(['head', 'assistant']), sendBackLotController);
lotRouter.post('/:lotNumber/review-ng', requireRole(['head', 'assistant']), reviewNgLotController);
lotRouter.post('/:lotNumber/confirm-ng', requireRole(['head', 'assistant']), confirmNgLotController);
