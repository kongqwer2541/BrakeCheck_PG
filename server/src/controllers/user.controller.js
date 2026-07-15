import {
  createUser,
  listUsers,
  resetUserPassword,
  updateUser
} from '../services/user.service.js';

export async function getUsers(req, res, next) {
  try {
    const result = await listUsers();
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function addUser(req, res, next) {
  try {
    const result = await createUser({
      actorUserId: req.user.id,
      employeeCode: req.body.employeeCode,
      fullName: req.body.fullName,
      position: req.body.position,
      role: req.body.role,
      status: req.body.status,
      temporaryPassword: req.body.temporaryPassword
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function editUser(req, res, next) {
  try {
    const result = await updateUser({
      userId: req.params.id,
      actorUserId: req.user.id,
      fullName: req.body.fullName,
      position: req.body.position,
      role: req.body.role,
      status: req.body.status
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const result = await resetUserPassword({
      userId: req.params.id,
      actorUserId: req.user.id,
      temporaryPassword: req.body.temporaryPassword
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}
