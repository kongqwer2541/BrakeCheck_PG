import { getDatabaseHealth } from '../services/database.service.js';

export function createDatabaseHealthHandler(getHealth = getDatabaseHealth) {
  return async function databaseHealthHandler(req, res, next) {
    try {
      const health = await getHealth();

      res.status(200).json(health);
    } catch (error) {
      error.statusCode = 503;
      next(error);
    }
  };
}

export const databaseHealth = createDatabaseHealthHandler();
