import { Router } from 'express';
import { getResultsLotsController } from '../controllers/results.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

export const resultsRouter = Router();

resultsRouter.use(requireAuth);
resultsRouter.use(requireRole(['head', 'assistant', 'officer']));

resultsRouter.get('/lots', getResultsLotsController);
