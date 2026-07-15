import { randomUUID } from 'node:crypto';
import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { db } from '../config/database.js';

const maxAttachmentSizeBytes = 5 * 1024 * 1024;
const maxAttachmentsPerLot = 10;
const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
]);
const allowedExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp']);
const fileTypeRules = {
  'application/pdf': {
    extensions: ['.pdf'],
    matches: (buffer) => buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))
  },
  'image/jpeg': {
    extensions: ['.jpg', '.jpeg'],
    matches: (buffer) => buffer.length >= 3
      && buffer[0] === 0xff
      && buffer[1] === 0xd8
      && buffer[2] === 0xff
  },
  'image/png': {
    extensions: ['.png'],
    matches: (buffer) => buffer.length >= 8
      && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  },
  'image/webp': {
    extensions: ['.webp'],
    matches: (buffer) => buffer.length >= 12
      && buffer.subarray(0, 4).equals(Buffer.from('RIFF'))
      && buffer.subarray(8, 12).equals(Buffer.from('WEBP'))
  }
};
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const attachmentRoot = path.resolve(__dirname, '../../../storage/attachments/lots');

function createHttpError(statusCode, message, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (details) {
    error.details = details;
  }

  return error;
}

function cleanLotNumber(lotNumber) {
  const value = String(lotNumber || '').trim();

  if (!value) {
    throw createHttpError(400, 'กรุณาระบุ Lot');
  }

  if (value.length > 20 || !/^[A-Za-z0-9-]+$/.test(value)) {
    throw createHttpError(400, 'Lot ไม่ถูกต้อง');
  }

  return value;
}

function requireActorUser(user) {
  const userId = Number(user?.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw createHttpError(401, 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
  }

  return userId;
}

function buildActorSnapshot(user) {
  return {
    actorName: String(user?.fullName || user?.username || '').trim() || null,
    actorPosition: String(user?.position || user?.role || '').trim() || null
  };
}

function getSafeExtension(originalName) {
  return path.extname(String(originalName || '')).toLowerCase();
}

function normalizeOriginalFileName(originalName) {
  const value = String(originalName || 'attachment').trim();
  const decoded = Buffer.from(value, 'latin1').toString('utf8').trim();
  const looksMojibake = /[à-ÿ]/.test(value);
  const decodedLooksUseful = decoded && !decoded.includes('\uFFFD') && decoded !== value;

  return looksMojibake && decodedLooksUseful ? decoded : value;
}

export function validateAttachmentFile(file) {
  if (!file) {
    throw createHttpError(400, 'กรุณาเลือกไฟล์แนบ');
  }

  if (!Number.isInteger(file.size) || file.size <= 0) {
    throw createHttpError(400, 'ไฟล์แนบไม่ถูกต้อง');
  }

  if (file.size > maxAttachmentSizeBytes) {
    throw createHttpError(400, 'ขนาดไฟล์แนบต้องไม่เกิน 5MB');
  }

  const extension = getSafeExtension(file.originalname);
  const originalName = normalizeOriginalFileName(file.originalname);

  const fileTypeRule = fileTypeRules[file.mimetype];

  if (
    !allowedMimeTypes.has(file.mimetype)
    || !allowedExtensions.has(extension)
    || !fileTypeRule?.extensions.includes(extension)
    || !Buffer.isBuffer(file.buffer)
    || !fileTypeRule.matches(file.buffer)
  ) {
    throw createHttpError(400, 'รองรับเฉพาะรูปภาพ JPG, PNG, WEBP และ PDF');
  }

  if (originalName.length > 255) {
    throw createHttpError(400, 'ชื่อไฟล์แนบยาวเกินไป');
  }

  return {
    extension,
    mimeType: file.mimetype,
    originalName
  };
}

export function createStoredAttachmentName({ lotId, originalName, id = randomUUID() }) {
  const extension = getSafeExtension(originalName);
  return `lot-${Number(lotId)}-${id}${extension}`;
}

export function validateAttachmentCount(activeCount) {
  const count = Number(activeCount || 0);

  if (!Number.isInteger(count) || count < 0) {
    throw createHttpError(400, 'จำนวนไฟล์แนบไม่ถูกต้อง');
  }

  if (count >= maxAttachmentsPerLot) {
    throw createHttpError(409, `Lot นี้มีไฟล์แนบครบ ${maxAttachmentsPerLot} ไฟล์แล้ว`);
  }
}

function mapAttachmentRow(row) {
  return {
    id: Number(row.id),
    lotNumber: row.lot_number,
    originalName: row.original_name,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size || 0),
    uploadedBy: row.uploaded_by ? Number(row.uploaded_by) : null,
    uploadedByName: row.uploaded_by_name || '',
    uploadedAt: row.uploaded_at
  };
}

async function findLotByNumber(lotNumber, connection = db) {
  const [rows] = await connection.execute(
    `SELECT id, lot_number
     FROM lots
     WHERE lot_number = ?
     LIMIT 1`,
    [lotNumber]
  );

  return rows[0] || null;
}

async function insertAttachmentAudit(connection, { lotId, action, reason, beforeData = null, afterData = null, user }) {
  const actorUserId = requireActorUser(user);
  const actorSnapshot = buildActorSnapshot(user);

  await connection.execute(
    `INSERT INTO lot_audit_logs (
       lot_id,
       action,
       reason,
       before_data,
       after_data,
       changed_by,
       actor_name_snapshot,
       actor_position_snapshot
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      lotId,
      action,
      reason,
      beforeData ? JSON.stringify(beforeData) : null,
      afterData ? JSON.stringify(afterData) : null,
      actorUserId,
      actorSnapshot.actorName,
      actorSnapshot.actorPosition
    ]
  );
}

export async function listLotAttachments({ lotNumber }) {
  const cleanedLotNumber = cleanLotNumber(lotNumber);
  const lot = await findLotByNumber(cleanedLotNumber);

  if (!lot) {
    throw createHttpError(404, 'ไม่พบ Lot ที่ต้องการ');
  }

  const [rows] = await db.execute(
    `SELECT
       a.id,
       l.lot_number,
       a.original_name,
       a.mime_type,
       a.file_size,
       a.uploaded_by,
       u.full_name AS uploaded_by_name,
       a.uploaded_at
     FROM lot_attachments a
     JOIN lots l ON l.id = a.lot_id
     LEFT JOIN users u ON u.id = a.uploaded_by
     WHERE a.lot_id = ?
       AND a.deleted_at IS NULL
     ORDER BY a.uploaded_at DESC, a.id DESC`,
    [lot.id]
  );

  return {
    ok: true,
    attachments: rows.map(mapAttachmentRow)
  };
}

export async function uploadLotAttachment({ lotNumber, file, user }) {
  const cleanedLotNumber = cleanLotNumber(lotNumber);
  requireActorUser(user);
  const fileInfo = validateAttachmentFile(file);
  const connection = await db.getConnection();
  let savedFilePath = '';

  try {
    await connection.beginTransaction();
    const lot = await findLotByNumber(cleanedLotNumber, connection);

    if (!lot) {
      throw createHttpError(404, 'ไม่พบ Lot ที่ต้องการ');
    }

    const [attachmentCountRows] = await connection.execute(
      `SELECT COUNT(*) AS total
       FROM lot_attachments
       WHERE lot_id = ?
         AND deleted_at IS NULL`,
      [lot.id]
    );
    validateAttachmentCount(Number(attachmentCountRows[0]?.total || 0));

    await mkdir(attachmentRoot, { recursive: true });
    const storedName = createStoredAttachmentName({
      lotId: lot.id,
      originalName: fileInfo.originalName
    });
    const filePath = path.join(attachmentRoot, storedName);
    await writeFile(filePath, file.buffer);
    savedFilePath = filePath;

    const actorUserId = requireActorUser(user);
    const [result] = await connection.execute(
      `INSERT INTO lot_attachments (
         lot_id,
         original_name,
         stored_name,
         mime_type,
         file_size,
         uploaded_by
       )
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        lot.id,
        fileInfo.originalName,
        storedName,
        fileInfo.mimeType,
        file.size,
        actorUserId
      ]
    );

    await insertAttachmentAudit(connection, {
      lotId: lot.id,
      action: 'upload_attachment',
      reason: `แนบไฟล์ ${fileInfo.originalName}`,
      afterData: {
        attachmentId: result.insertId,
        originalName: fileInfo.originalName,
        fileSize: file.size,
        mimeType: fileInfo.mimeType
      },
      user
    });

    await connection.commit();

    return listLotAttachments({ lotNumber: cleanedLotNumber });
  } catch (error) {
    await connection.rollback();

    if (savedFilePath) {
      await unlink(savedFilePath).catch(() => {});
    }

    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteLotAttachment({ lotNumber, attachmentId, user }) {
  const cleanedLotNumber = cleanLotNumber(lotNumber);
  const cleanedAttachmentId = Number(attachmentId);

  if (!Number.isInteger(cleanedAttachmentId) || cleanedAttachmentId <= 0) {
    throw createHttpError(400, 'ไฟล์แนบไม่ถูกต้อง');
  }

  const actorUserId = requireActorUser(user);
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const lot = await findLotByNumber(cleanedLotNumber, connection);
    if (!lot) {
      throw createHttpError(404, 'ไม่พบ Lot ที่ต้องการ');
    }

    const [rows] = await connection.execute(
      `SELECT id, original_name, mime_type, file_size
       FROM lot_attachments
       WHERE id = ?
         AND lot_id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [cleanedAttachmentId, lot.id]
    );

    const attachment = rows[0];
    if (!attachment) {
      throw createHttpError(404, 'ไม่พบไฟล์แนบที่ต้องการ');
    }

    await connection.execute(
      `UPDATE lot_attachments
       SET deleted_at = CURRENT_TIMESTAMP,
           deleted_by = ?
       WHERE id = ?
         AND lot_id = ?
         AND deleted_at IS NULL`,
      [actorUserId, cleanedAttachmentId, lot.id]
    );

    await insertAttachmentAudit(connection, {
      lotId: lot.id,
      action: 'delete_attachment',
      reason: `ลบไฟล์แนบ ${attachment.original_name}`,
      beforeData: {
        attachmentId: attachment.id,
        originalName: attachment.original_name,
        fileSize: attachment.file_size,
        mimeType: attachment.mime_type
      },
      user
    });

    await connection.commit();

    return listLotAttachments({ lotNumber: cleanedLotNumber });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getLotAttachmentDownload({ lotNumber, attachmentId }) {
  const cleanedLotNumber = cleanLotNumber(lotNumber);
  const cleanedAttachmentId = Number(attachmentId);

  if (!Number.isInteger(cleanedAttachmentId) || cleanedAttachmentId <= 0) {
    throw createHttpError(400, 'ไฟล์แนบไม่ถูกต้อง');
  }

  const [rows] = await db.execute(
    `SELECT
       a.id,
       a.original_name,
       a.stored_name,
       a.mime_type
     FROM lot_attachments a
     JOIN lots l ON l.id = a.lot_id
     WHERE a.id = ?
       AND l.lot_number = ?
       AND a.deleted_at IS NULL
     LIMIT 1`,
    [cleanedAttachmentId, cleanedLotNumber]
  );

  const attachment = rows[0];
  if (!attachment) {
    throw createHttpError(404, 'ไม่พบไฟล์แนบที่ต้องการ');
  }

  const filePath = path.join(attachmentRoot, attachment.stored_name);
  try {
    await access(filePath);
  } catch {
    throw createHttpError(404, 'ไม่พบไฟล์แนบบนเครื่องแม่ กรุณาติดต่อผู้ดูแลระบบ');
  }

  return {
    originalName: attachment.original_name,
    mimeType: attachment.mime_type,
    filePath
  };
}
