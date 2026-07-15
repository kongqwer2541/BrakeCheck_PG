import assert from 'node:assert/strict';
import test from 'node:test';

import { db } from '../config/database.js';
import {
  createStoredAttachmentName,
  getLotAttachmentDownload,
  validateAttachmentCount,
  validateAttachmentFile
} from './lot-attachment.service.js';

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

test('getLotAttachmentDownload returns a friendly error when file is missing from disk', async () => {
  const originalExecute = db.execute;
  db.execute = async () => [[{
    id: 1,
    original_name: 'qc-photo.png',
    stored_name: 'missing-step-7-test-file.png',
    mime_type: 'image/png'
  }]];

  try {
    await assert.rejects(
      () => getLotAttachmentDownload({ lotNumber: 'LOT-1', attachmentId: 1 }),
      (error) => {
        assert.equal(error.statusCode, 404);
        assert.match(error.message, /ไม่พบไฟล์แนบบนเครื่องแม่/);
        assert.doesNotMatch(error.message, /missing-step-7-test-file/);
        return true;
      }
    );
  } finally {
    db.execute = originalExecute;
  }
});
