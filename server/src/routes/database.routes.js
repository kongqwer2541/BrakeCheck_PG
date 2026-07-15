import { Router } from 'express';
import { databaseHealth } from '../controllers/database.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

export const databaseRouter = Router();

databaseRouter.get('/health', requireAuth, requireRole(['head', 'assistant']), databaseHealth);
