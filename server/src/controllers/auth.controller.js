import {
  changePassword,
  getCurrentUser,
  login,
  logout
} from '../services/auth.service.js';
import { getAuthSessionRetentionStatus } from '../services/auth-session.service.js';

export async function loginUser(req, res, next) {
  try {
    const result = await login(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function currentUser(req, res, next) {
  try {
    const result = await getCurrentUser(req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function logoutUser(req, res, next) {
  try {
    const result = await logout({
      userId: req.user.id,
      tokenId: req.auth.tokenId
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function changeUserPassword(req, res, next) {
  try {
    const result = await changePassword({
      userId: req.user.id,
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function sessionRetentionStatus(req, res, next) {
  try {
    const result = await getAuthSessionRetentionStatus();
    res.json(result);
  } catch (error) {
    next(error);
  }
}
