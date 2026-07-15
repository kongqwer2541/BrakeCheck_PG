import { db } from '../config/database.js';
import { env } from '../config/env.js';

export const requiredTables = [
  'users',
  'auth_sessions',
  'user_audit_logs',
  'excel_import_batches',
  'lots',
  'lot_audit_logs',
  'lot_attachments',
  'sampling_rules',
  'dimension_instrument_prefixes',
  'form_config',
  'system_setting_audit_logs',
  'dimension_inspections',
  'packing_inspections',
  'dimension_inspection_values'
];

export function buildDatabaseHealthResult({ database, mysqlVersion, tableRows }) {
  const foundTables = tableRows.map((row) => row.TABLE_NAME || row.table_name);
  const missingTables = requiredTables.filter((tableName) => !foundTables.includes(tableName));

  return {
    ok: missingTables.length === 0,
    database,
    mysqlVersion,
    requiredTables,
    foundTables,
    missingTables
  };
}

export async function getDatabaseHealth() {
  const [versionRows] = await db.execute('SELECT VERSION() AS version');
  const tablePlaceholders = requiredTables.map(() => '?').join(', ');

  const [tableRows] = await db.execute(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = ?
       AND table_name IN (${tablePlaceholders})
     ORDER BY table_name`,
    [env.db.name, ...requiredTables]
  );

  return buildDatabaseHealthResult({
    database: env.db.name,
    mysqlVersion: versionRows[0].version,
    tableRows
  });
}
