import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

process.env.SESSION_SECRET = 'test_session_secret_at_least_32_chars';

const { db, postgresDb } = await import('../config/database.js');
const {
  createStoredAttachmentName,
  deleteLotAttachment,
  getLotAttachmentDownload,
  listLotAttachments,
  uploadLotAttachment,
  validateAttachmentCount,
  validateAttachmentFile
} = await import('./lot-attachment.service.js');

test('attachment service uses PostgreSQL without MySQL pool APIs', async () => {
  const source = await readFile(new URL('./lot-attachment.service.js', import.meta.url), 'utf8');

  assert.match(source, /import \{ postgresDb \}/);
  assert.match(source, /RETURNING id/i);
  assert.doesNotMatch(source, /\bdb\.execute|\.beginTransaction\(|\.execute\(/);
});

test('validateAttachmentFile accepts image and PDF files', () => {
  assert.doesNotThrow(() => validateAttachmentFile({
    originalname: 'part-photo.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00])
  }));

  assert.doesNotThrow(() => validateAttachmentFile({
    originalname: 'drawing.pdf',
    mimetype: 'application/pdf',
    size: 2048,
    buffer: Buffer.from('%PDF-1.7')
  }));
});

test('validateAttachmentFile rejects unsafe file type and oversized file', () => {
  assert.throws(() => validateAttachmentFile({
    originalname: 'script.exe',
    mimetype: 'application/octet-stream',
    size: 1024,
    buffer: Buffer.from('MZ')
  }), /รองรับเฉพาะรูปภาพ/);

  assert.throws(() => validateAttachmentFile({
    originalname: 'large.pdf',
    mimetype: 'application/pdf',
    size: 6 * 1024 * 1024,
    buffer: Buffer.from('%PDF-1.7')
  }), /ขนาดไฟล์/);
});

test('validateAttachmentFile rejects spoofed file content', () => {
  assert.throws(() => validateAttachmentFile({
    originalname: 'fake.pdf',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('not a real pdf')
  }), /รองรับเฉพาะรูปภาพ/);

  assert.throws(() => validateAttachmentFile({
    originalname: 'fake.png',
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.from([0xff, 0xd8, 0xff])
  }), /รองรับเฉพาะรูปภาพ/);
});

test('validateAttachmentFile accepts PDF marker near the file start', () => {
  assert.doesNotThrow(() => validateAttachmentFile({
    originalname: 'scanned-document.pdf',
    mimetype: 'application/pdf',
    size: 2048,
    buffer: Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf, 0x0a]),
      Buffer.from('%PDF-1.7')
    ])
  }));
});

test('validateAttachmentFile restores Thai file names decoded as latin1', () => {
  const thaiName = 'ตรวจมิติหลังการลงทุนUSA.png';
  const mojibakeName = Buffer.from(thaiName, 'utf8').toString('latin1');
  const result = validateAttachmentFile({
    originalname: mojibakeName,
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  });

  assert.equal(result.originalName, thaiName);
});

test('createStoredAttachmentName keeps only safe generated file names', () => {
  const storedName = createStoredAttachmentName({
    lotId: 12,
    originalName: '../../unsafe name.pdf',
    id: 'abc-123'
  });

  assert.equal(storedName, 'lot-12-abc-123.pdf');
});

test('validateAttachmentCount limits active attachments per lot', () => {
  assert.doesNotThrow(() => validateAttachmentCount(9));
  assert.throws(() => validateAttachmentCount(10), /ครบ 10 ไฟล์แล้ว/);
  assert.throws(() => validateAttachmentCount(-1), /จำนวนไฟล์แนบไม่ถูกต้อง/);
});

test('locks the Lot before validating the attachment limit', async (t) => {
  const originalConnect = postgresDb.connect;
  const clientCalls = [];

  t.after(() => {
    postgresDb.connect = originalConnect;
  });

  postgresDb.connect = async () => ({
    query: async (sql, params = []) => {
      clientCalls.push({ sql, params });

      if (/SELECT id, lot_number/i.test(sql)) {
        return { rows: [{ id: 7, lot_number: 'LOT-1' }] };
      }
      if (/SELECT COUNT\(\*\) AS total/i.test(sql)) {
        return { rows: [{ total: '10' }] };
      }

      return { rows: [], rowCount: 0 };
    },
    release: () => {}
  });

  await assert.rejects(
    () => uploadLotAttachment({
      lotNumber: 'LOT-1',
      file: {
        originalname: 'qc-photo.jpg',
        mimetype: 'image/jpeg',
        size: 4,
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00])
      },
      user: { id: 1, fullName: 'Admin', position: 'QC' }
    }),
    (error) => error.statusCode === 409
  );

  const lotLookup = clientCalls.find(({ sql }) => /SELECT id, lot_number/i.test(sql));
  assert.match(lotLookup.sql, /FOR UPDATE/i);
  assert.equal(clientCalls.at(-1).sql, 'ROLLBACK');
});

test('lists active attachments with PostgreSQL parameters', async (t) => {
  const originalLegacyExecute = db.execute;
  const originalQuery = postgresDb.query;
  const calls = [];

  t.after(() => {
    db.execute = originalLegacyExecute;
    postgresDb.query = originalQuery;
  });

  db.execute = async () => {
    throw new Error('Legacy MySQL pool was used.');
  };
  postgresDb.query = async (sql, params) => {
    calls.push({ sql, params });

    if (/SELECT id, lot_number/i.test(sql)) {
      return { rows: [{ id: 7, lot_number: 'LOT-1' }] };
    }

    return {
      rows: [{
        id: 1,
        lot_number: 'LOT-1',
        original_name: 'qc-photo.png',
        mime_type: 'image/png',
        file_size: 1024,
        uploaded_by: 1,
        uploaded_by_name: 'Admin',
        uploaded_at: new Date('2026-07-18T00:00:00Z')
      }]
    };
  };

  const result = await listLotAttachments({ lotNumber: 'LOT-1' });

  assert.equal(result.attachments[0].originalName, 'qc-photo.png');
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /lot_number = \$1/i);
  assert.match(calls[1].sql, /a\.lot_id = \$1/i);
  assert.deepEqual(calls[1].params, [7]);
});

test('soft-deletes attachment and writes audit in one PostgreSQL transaction', async (t) => {
  const originalLegacyGetConnection = db.getConnection;
  const originalQuery = postgresDb.query;
  const originalConnect = postgresDb.connect;
  const clientCalls = [];
  let released = false;

  t.after(() => {
    db.getConnection = originalLegacyGetConnection;
    postgresDb.query = originalQuery;
    postgresDb.connect = originalConnect;
  });

  db.getConnection = async () => {
    throw new Error('Legacy MySQL pool was used.');
  };
  postgresDb.query = async (sql) => {
    if (/SELECT id, lot_number/i.test(sql)) {
      return { rows: [{ id: 7, lot_number: 'LOT-1' }] };
    }
    return { rows: [] };
  };
  postgresDb.connect = async () => ({
    query: async (sql, params = []) => {
      clientCalls.push({ sql, params });

      if (/SELECT id, lot_number/i.test(sql)) {
        return { rows: [{ id: 7, lot_number: 'LOT-1' }] };
      }
      if (/SELECT id, original_name/i.test(sql)) {
        return {
          rows: [{
            id: 3,
            original_name: 'qc-photo.png',
            mime_type: 'image/png',
            file_size: 1024
          }]
        };
      }

      return { rows: [], rowCount: 1 };
    },
    release: () => {
      released = true;
    }
  });

  const result = await deleteLotAttachment({
    lotNumber: 'LOT-1',
    attachmentId: 3,
    user: { id: 1, fullName: 'Admin', position: 'QC' }
  });

  assert.deepEqual(result.attachments, []);
  assert.equal(clientCalls[0].sql, 'BEGIN');
  assert.equal(clientCalls.at(-1).sql, 'COMMIT');
  assert.equal(released, true);
  assert.ok(clientCalls.some(({ sql }) => /SELECT id, original_name[\s\S]*FOR UPDATE/i.test(sql)));
  assert.ok(clientCalls.some(({ sql }) => /deleted_by = \$1/i.test(sql)));
  assert.ok(clientCalls.some(({ sql }) => /INSERT INTO lot_audit_logs/i.test(sql)));
  assert.equal(clientCalls.some(({ sql }) => sql.includes('?')), false);
});

test('rolls back without audit when no active attachment is deleted', async (t) => {
  const originalConnect = postgresDb.connect;
  const originalQuery = postgresDb.query;
  const clientCalls = [];

  t.after(() => {
    postgresDb.connect = originalConnect;
    postgresDb.query = originalQuery;
  });

  postgresDb.query = async () => ({ rows: [] });
  postgresDb.connect = async () => ({
    query: async (sql, params = []) => {
      clientCalls.push({ sql, params });

      if (/SELECT id, lot_number/i.test(sql)) {
        return { rows: [{ id: 7, lot_number: 'LOT-1' }] };
      }
      if (/SELECT id, original_name/i.test(sql)) {
        return {
          rows: [{
            id: 3,
            original_name: 'qc-photo.png',
            mime_type: 'image/png',
            file_size: 1024
          }]
        };
      }
      if (/UPDATE lot_attachments/i.test(sql)) {
        return { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 1 };
    },
    release: () => {}
  });

  await assert.rejects(
    () => deleteLotAttachment({
      lotNumber: 'LOT-1',
      attachmentId: 3,
      user: { id: 1, fullName: 'Admin', position: 'QC' }
    }),
    (error) => error.statusCode === 404
  );

  assert.equal(clientCalls.some(({ sql }) => /INSERT INTO lot_audit_logs/i.test(sql)), false);
  assert.equal(clientCalls.at(-1).sql, 'ROLLBACK');
});

test('getLotAttachmentDownload returns a friendly error when file is missing from disk', async (t) => {
  const originalLegacyExecute = db.execute;
  const originalQuery = postgresDb.query;

  t.after(() => {
    db.execute = originalLegacyExecute;
    postgresDb.query = originalQuery;
  });

  db.execute = async () => {
    throw new Error('Legacy MySQL pool was used.');
  };
  postgresDb.query = async () => ({ rows: [{
    id: 1,
    original_name: 'qc-photo.png',
    stored_name: 'missing-step-7-test-file.png',
    mime_type: 'image/png'
  }] });

  await assert.rejects(
    () => getLotAttachmentDownload({ lotNumber: 'LOT-1', attachmentId: 1 }),
    (error) => {
      assert.equal(error.statusCode, 404);
      assert.match(error.message, /ไม่พบไฟล์แนบบนเครื่องแม่/);
      assert.doesNotMatch(error.message, /missing-step-7-test-file/);
      return true;
    }
  );
});
