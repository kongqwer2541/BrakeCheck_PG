import { Router } from 'express';
import {
  getQualitySummaryController,
  getQualitySummaryLotsController
} from '../controllers/summary.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

export const summaryRouter = Router();

summaryRouter.use(requireAuth);
summaryRouter.use(requireRole(['head', 'assistant']));
summaryRouter.get('/', getQualitySummaryController);
summaryRouter.get('/lots', getQualitySummaryLotsController);
