import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import {
  addUser,
  editUser,
  getUsers,
  resetPassword
} from '../controllers/user.controller.js';

export const userRouter = Router();

userRouter.use(requireAuth);
userRouter.use(requireRole('head'));

userRouter.get('/', getUsers);
userRouter.post('/', addUser);
userRouter.put('/:id', editUser);
userRouter.post('/:id/reset-password', resetPassword);
