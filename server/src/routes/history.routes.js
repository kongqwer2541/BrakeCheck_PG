import { Router } from 'express';
import {
  getAuditHistoryController,
  getImportHistoryController,
  getLotHistoryController
} from '../controllers/history.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

export const historyRouter = Router();

historyRouter.use(requireAuth);
historyRouter.use(requireRole(['head', 'assistant', 'officer']));

historyRouter.get('/lots', getLotHistoryController);
historyRouter.get('/imports', getImportHistoryController);
historyRouter.get('/audits', getAuditHistoryController);
