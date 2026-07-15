import { Router } from 'express';
import {
  changeUserPassword,
  currentUser,
  loginUser,
  logoutUser,
  sessionRetentionStatus
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

export const authRouter = Router();

authRouter.post('/login', loginUser);
authRouter.get('/me', requireAuth, currentUser);
authRouter.post('/logout', requireAuth, logoutUser);
authRouter.post('/change-password', requireAuth, changeUserPassword);
authRouter.get(
  '/sessions/retention-status',
  requireAuth,
  requireRole('head'),
  sessionRetentionStatus
);
