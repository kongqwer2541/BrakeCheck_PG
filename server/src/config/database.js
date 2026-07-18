import mysql from 'mysql2/promise';
import { Pool } from 'pg';
import { env } from './env.js';

// Existing services keep the MySQL-style pool until their SQL is migrated in a later phase.
export const db = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export const postgresDb = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  options: '-c timezone=Asia/Bangkok',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

postgresDb.on('error', () => {
  console.error('PostgreSQL pool idle client error.');
});
