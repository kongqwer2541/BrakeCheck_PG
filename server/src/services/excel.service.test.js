import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ExcelJS from 'exceljs';

process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars';

const { db, postgresDb } = await import('../config/database.js');
const { previewExcelImport, saveExcelImport } = await import('./excel.service.js');

const headers = {
  A: 'Lot',
  E: 'เลขที่ใบสั่งซื้อ',
  F: 'Code',
  H: 'บันทึก(รหัสของนอก)',
  M: 'เกรด',
  N: 'เจาะ-ไม่เจาะ',
  O: 'กว้าง-หนา-ยาว',
  R: 'Lot Pack',
  T: 'วันฝน',
  U: 'ยิงเลเซอร์',
  W: 'จำนวนชิ้น',
  X: 'Lot ผลิต',
  AJ: 'ดอกคว้าน',
  AK: 'ดอกเจาะ',
  AL: 'รุ่นผลิตภัณฑ์',
  AM: 'รีเวท',
  AN: 'หมายเหตุ'
};

async function createExcelFile() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('DATA');

  for (const [column, header] of Object.entries(headers)) {
    worksheet.getCell(`${column}1`).value = header;
  }

  worksheet.getCell('A2').value = 'LOT-001';
  worksheet.getCell('E2').value = 'PO-TEST';
  worksheet.getCell('F2').value = 'CODE-TEST';
  worksheet.getCell('H2').value = 'Remark';
  worksheet.getCell('M2').value = 'A';
  worksheet.getCell('N2').value = '10x20';
  worksheet.getCell('O2').value = '10x20';
  worksheet.getCell('R2').value = '10001';
  worksheet.getCell('T2').value = new Date(2026, 6, 18);
  worksheet.getCell('U2').value = 'Laser';
  worksheet.getCell('W2').value = 100;
  worksheet.getCell('X2').value = '';
  worksheet.getCell('AJ2').value = 1;
  worksheet.getCell('AK2').value = 2;
  worksheet.getCell('AL2').value = 'MODEL-TEST';
  worksheet.getCell('AM2').value = 'RIVET';

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    originalname: 'phase-5-2.xlsx',
    size: buffer.length,
    buffer
  };
}

test('excel service uses PostgreSQL without MySQL pool APIs', async () => {
  const source = await readFile(new URL('./excel.service.js', import.meta.url), 'utf8');

  assert.match(source, /import \{ postgresDb \}/);
  assert.match(source, /RETURNING id/i);
  assert.match(source, /error\.code === '23505'/);
  assert.doesNotMatch(source, /\bdb\.execute|\.beginTransaction\(|\.execute\(/);
});

test('previews Excel with read-only PostgreSQL duplicate checks', async (t) => {
  const originalLegacyExecute = db.execute;
  const originalQuery = postgresDb.query;
  const originalConnect = postgresDb.connect;
  const queries = [];

  t.after(() => {
    db.execute = originalLegacyExecute;
    postgresDb.query = originalQuery;
    postgresDb.connect = originalConnect;
  });

  db.execute = async () => {
    throw new Error('Legacy MySQL pool was used.');
  };
  postgresDb.query = async (sql, params) => {
    queries.push({ sql, params });
    return { rows: [] };
  };
  postgresDb.connect = async () => {
    throw new Error('Preview must not start a transaction.');
  };

  const result = await previewExcelImport({ file: await createExcelFile() });

  assert.equal(result.ok, true);
  assert.equal(result.summary.newLots, 1);
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /IN \(\$1\)/);
  assert.deepEqual(queries[0].params, ['LOT-001']);
});

test('saves an Excel batch and its lots in one PostgreSQL transaction', async (t) => {
  const originalLegacyExecute = db.execute;
  const originalLegacyGetConnection = db.getConnection;
  const originalQuery = postgresDb.query;
  const originalConnect = postgresDb.connect;
  const poolQueries = [];
  const clientQueries = [];
  let released = false;

  t.after(() => {
    db.execute = originalLegacyExecute;
    db.getConnection = originalLegacyGetConnection;
    postgresDb.query = originalQuery;
    postgresDb.connect = originalConnect;
  });

  db.execute = async () => {
    throw new Error('Legacy MySQL pool was used.');
  };
  db.getConnection = async () => {
    throw new Error('Legacy MySQL pool was used.');
  };
  postgresDb.query = async (sql, params) => {
    poolQueries.push({ sql, params });
    return { rows: [] };
  };
  postgresDb.connect = async () => ({
    query: async (sql, params = []) => {
      clientQueries.push({ sql, params });

      if (/INSERT INTO excel_import_batches/i.test(sql)) {
        return { rows: [{ id: 42 }], rowCount: 1 };
      }
      if (/FROM sampling_rules/i.test(sql)) {
        return { rows: [{ sample_count: 5 }] };
      }

      return { rows: [], rowCount: 1 };
    },
    release: () => {
      released = true;
    }
  });

  const result = await saveExcelImport({
    file: await createExcelFile(),
    user: { id: 1 }
  });

  assert.equal(result.importBatchId, 42);
  assert.equal(poolQueries.length, 2);
  assert.equal(clientQueries[0].sql, 'BEGIN');
  assert.equal(clientQueries.at(-1).sql, 'COMMIT');
  assert.equal(released, true);
  assert.ok(clientQueries.some(({ sql }) => /RETURNING id/i.test(sql)));
  assert.ok(clientQueries.some(({ sql }) => /VALUES \(\$1, \$2/i.test(sql)));
  assert.equal(clientQueries.some(({ sql }) => sql.includes('?')), false);
});

test('rejects an Excel import without an authenticated actor before database access', async (t) => {
  const originalQuery = postgresDb.query;
  const originalConnect = postgresDb.connect;
  let databaseAccessed = false;

  t.after(() => {
    postgresDb.query = originalQuery;
    postgresDb.connect = originalConnect;
  });

  postgresDb.query = async () => {
    databaseAccessed = true;
    throw new Error('Database must not be accessed without an actor.');
  };
  postgresDb.connect = async () => {
    databaseAccessed = true;
    throw new Error('Database must not be accessed without an actor.');
  };
  const file = await createExcelFile();

  await assert.rejects(
    () => saveExcelImport({ file }),
    (error) => error.statusCode === 401
  );

  assert.equal(databaseAccessed, false);
});
