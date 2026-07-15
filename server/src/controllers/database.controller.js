import { getDatabaseHealth } from '../services/database.service.js';

export async function databaseHealth(req, res, next) {
  try {
    const health = await getDatabaseHealth();
    const statusCode = health.ok ? 200 : 500;

    res.status(statusCode).json(health);
  } catch (error) {
    next(error);
  }
}
