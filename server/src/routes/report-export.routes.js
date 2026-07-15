import { Router } from 'express';
import {
  downloadLotReportExcelController,
  downloadLotReportPdfController,
  getReportExportLotsController
} from '../controllers/report-export.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

export const reportExportRouter = Router();

reportExportRouter.use(requireAuth);
reportExportRouter.use(requireRole(['head', 'assistant']));

reportExportRouter.get('/lots', getReportExportLotsController);
reportExportRouter.get('/lots/:lotNumber/excel', downloadLotReportExcelController);
reportExportRouter.get('/lots/:lotNumber/pdf', downloadLotReportPdfController);
