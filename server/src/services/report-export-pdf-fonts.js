import fs from 'node:fs';
import { createHttpError } from './report-export-validation.js';

const defaultPdfThaiFontPath = 'C:\\Windows\\Fonts\\tahoma.ttf';
const defaultPdfThaiBoldFontPath = 'C:\\Windows\\Fonts\\tahomabd.ttf';
const pdfThaiFontEnvName = 'PDF_THAI_FONT_PATH';
const pdfThaiBoldFontEnvName = 'PDF_THAI_BOLD_FONT_PATH';

function getEnvPath(name) {
  return process.env[name]?.trim() || null;
}

function pdfFontFileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function getPdfThaiFontPaths() {
  return {
    regular: getEnvPath(pdfThaiFontEnvName) || defaultPdfThaiFontPath,
    bold: getEnvPath(pdfThaiBoldFontEnvName) || defaultPdfThaiBoldFontPath
  };
}

export function assertPdfThaiFontsAvailable() {
  const fontPaths = getPdfThaiFontPaths();

  if (!pdfFontFileExists(fontPaths.regular)) {
    throw createHttpError(
      500,
      `ไม่พบฟอนต์ภาษาไทยสำหรับ Export PDF กรุณาติดตั้งฟอนต์ Tahoma หรือกำหนด ${pdfThaiFontEnvName} ในไฟล์ .env`
    );
  }

  if (getEnvPath(pdfThaiBoldFontEnvName) && !pdfFontFileExists(fontPaths.bold)) {
    throw createHttpError(
      500,
      `ไม่พบฟอนต์ภาษาไทยตัวหนาสำหรับ Export PDF กรุณาตรวจสอบ ${pdfThaiBoldFontEnvName} ในไฟล์ .env`
    );
  }

  return fontPaths;
}

export function registerPdfFonts(doc, fontPaths) {
  doc.reportFonts = {
    regular: false,
    bold: false
  };

  doc.registerFont('ReportRegular', fontPaths.regular);
  doc.font('ReportRegular');
  doc.reportFonts.regular = true;

  if (pdfFontFileExists(fontPaths.bold)) {
    doc.registerFont('ReportBold', fontPaths.bold);
    doc.reportFonts.bold = true;
  }
}

export function pdfFont(doc, bold = false) {
  if (bold && doc.reportFonts?.bold) {
    doc.font('ReportBold');
    return;
  }

  if (doc.reportFonts?.regular) {
    doc.font('ReportRegular');
    return;
  }

  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
}
