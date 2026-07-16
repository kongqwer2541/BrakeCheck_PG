import { postgresDb } from '../config/database.js';
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

export function buildDatabaseHealthResult({ database, databaseVersion, tableRows }) {
  const foundTables = tableRows.map((row) => row.TABLE_NAME || row.table_name);
  const missingTables = requiredTables.filter((tableName) => !foundTables.includes(tableName));

  return {
    ok: true,
    schemaReady: missingTables.length === 0,
    engine: 'postgresql',
    database,
    databaseVersion,
    requiredTables,
    foundTables,
    missingTables
  };
}

export async function getDatabaseHealth(executor = postgresDb) {
  const metadataResult = await executor.query(
    `SELECT current_database() AS database,
            current_setting('server_version') AS version`
  );
  const tableResult = await executor.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = $1
       AND table_type = 'BASE TABLE'
       AND table_name = ANY($2::text[])
     ORDER BY table_name`,
    ['public', requiredTables]
  );
  const metadata = metadataResult.rows[0] || {};

  return buildDatabaseHealthResult({
    database: metadata.database || env.db.name,
    databaseVersion: metadata.version,
    tableRows: tableResult.rows
  });
}
