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

test('database health separates PostgreSQL connectivity from schema readiness', async () => {
  const { buildDatabaseHealthResult, requiredTables } = await loadDatabaseService();
  const tableRows = requiredTables
    .filter((tableName) => tableName !== 'packing_inspections')
    .map((tableName) => ({ table_name: tableName }));

  const health = buildDatabaseHealthResult({
    database: 'brakecheck_test',
    databaseVersion: '17.test',
    tableRows
  });

  assert.equal(health.ok, true);
  assert.equal(health.schemaReady, false);
  assert.equal(health.engine, 'postgresql');
  assert.deepEqual(health.missingTables, ['packing_inspections']);
  assert.equal(health.database, 'brakecheck_test');
  assert.equal(health.databaseVersion, '17.test');
});

test('database health uses parameterized read-only PostgreSQL queries', async () => {
  const { getDatabaseHealth, requiredTables } = await loadDatabaseService();
  const calls = [];
  const executor = {
    async query(sql, params = []) {
      calls.push({ sql, params });

      if (calls.length === 1) {
        return {
          rows: [{ database: 'brakecheck_test', version: '17.test' }]
        };
      }

      return {
        rows: requiredTables.map((tableName) => ({ table_name: tableName }))
      };
    }
  };

  const health = await getDatabaseHealth(executor);
  const executedSql = calls.map((call) => call.sql).join('\n');

  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /current_database\(\)/i);
  assert.match(calls[1].sql, /information_schema\.tables/i);
  assert.deepEqual(calls[1].params, ['public', requiredTables]);
  assert.doesNotMatch(executedSql, /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE)\b/i);
  assert.equal(health.ok, true);
  assert.equal(health.schemaReady, true);
});
