import assert from 'node:assert/strict';
import test from 'node:test';

const expectedRequiredTables = [
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

async function loadDatabaseService() {
  process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars';
  return import('./database.service.js');
}

test('database health tracks every important QC table', async () => {
  const { requiredTables } = await loadDatabaseService();

  assert.ok(Array.isArray(requiredTables), 'requiredTables should be exported as an array');
  assert.deepEqual([...requiredTables].sort(), [...expectedRequiredTables].sort());
});

test('database health reports missing QC tables as unhealthy', async () => {
  const { buildDatabaseHealthResult, requiredTables } = await loadDatabaseService();
  const tableRows = requiredTables
    .filter((tableName) => tableName !== 'packing_inspections')
    .map((tableName) => ({ table_name: tableName }));

  const health = buildDatabaseHealthResult({
    database: 'brakecheck_test',
    mysqlVersion: '8.0.test',
    tableRows
  });

  assert.equal(health.ok, false);
  assert.deepEqual(health.missingTables, ['packing_inspections']);
  assert.equal(health.database, 'brakecheck_test');
  assert.equal(health.mysqlVersion, '8.0.test');
});
