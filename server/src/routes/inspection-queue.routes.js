import { Router } from 'express';
import { getInspectionQueueController } from '../controllers/inspection-queue.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

export const inspectionQueueRouter = Router();

inspectionQueueRouter.use(requireAuth);
inspectionQueueRouter.use(requireRole(['head', 'assistant', 'officer']));

inspectionQueueRouter.get('/:queueType', getInspectionQueueController);
