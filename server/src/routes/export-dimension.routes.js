import { Router } from 'express';
import {
  downloadExportDimensionExcelController,
  getExportDimensionPreviewController
} from '../controllers/export-dimension.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

export const exportDimensionRouter = Router();

exportDimensionRouter.use(requireAuth);
exportDimensionRouter.use(requireRole(['head', 'assistant']));

exportDimensionRouter.get('/preview', getExportDimensionPreviewController);
exportDimensionRouter.post('/excel', downloadExportDimensionExcelController);
