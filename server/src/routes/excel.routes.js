import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { importExcel, previewExcel } from '../controllers/excel.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const maxFileSizeMb = 10;
const allowedExtensions = ['.xlsx', '.xlsm'];

function excelFileFilter(req, file, callback) {
  const extension = path.extname(file.originalname || '').toLowerCase();

  if (!allowedExtensions.includes(extension)) {
    const error = new Error('รองรับเฉพาะไฟล์ .xlsx และ .xlsm เท่านั้น');
    error.statusCode = 400;
    callback(error);
    return;
  }

  callback(null, true);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSizeMb * 1024 * 1024
  },
  fileFilter: excelFileFilter
});

function uploadExcelFile(req, res, next) {
  upload.single('excelFile')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      error.message = `ไฟล์ Excel ต้องไม่เกิน ${maxFileSizeMb}MB`;
    }

    error.statusCode = error.statusCode || 400;
    next(error);
  });
}

export const excelRouter = Router();

excelRouter.use(requireAuth);
excelRouter.use(requireRole(['head', 'assistant']));

excelRouter.post('/preview', uploadExcelFile, previewExcel);
excelRouter.post('/import', uploadExcelFile, importExcel);
