import { previewExcelImport, saveExcelImport } from '../services/excel.service.js';

export async function previewExcel(req, res, next) {
  try {
    const result = await previewExcelImport({
      file: req.file,
      user: req.user
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

function parseConfirmedProductionDates(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch (error) {
    return value
      .split(',')
      .map((date) => date.trim())
      .filter(Boolean);
  }
}

export async function importExcel(req, res, next) {
  try {
    const result = await saveExcelImport({
      file: req.file,
      user: req.user,
      confirmedProductionDates: parseConfirmedProductionDates(req.body?.confirmedProductionDates)
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
