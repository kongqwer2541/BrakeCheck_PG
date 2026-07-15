import { Router } from 'express';

import {
  createInspectionTopicController,
  deactivateInspectionTopicController,
  getSystemSettingsController,
  updateInstrumentPrefixesController,
  updateInspectionTopicDisplayController,
  updateInspectionTopicDisplaysController,
  updateSamplingRulesController
} from '../controllers/settings.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

export const settingsRouter = Router();

settingsRouter.use(requireAuth);
settingsRouter.use(requireRole(['head', 'assistant']));

settingsRouter.get('/', getSystemSettingsController);
settingsRouter.post('/topics', createInspectionTopicController);
settingsRouter.patch('/topics/batch-display', updateInspectionTopicDisplaysController);
settingsRouter.patch('/topics/:topicId', updateInspectionTopicDisplayController);
settingsRouter.post('/topics/:topicId/deactivate', deactivateInspectionTopicController);
settingsRouter.put('/sampling-rules', updateSamplingRulesController);
settingsRouter.put('/instrument-prefixes', updateInstrumentPrefixesController);
