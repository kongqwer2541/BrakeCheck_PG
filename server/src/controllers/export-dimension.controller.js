import {
  buildExportDimensionExcel,
  getExportDimensionPreview
} from '../services/export-dimension.service.js';

export async function getExportDimensionPreviewController(req, res, next) {
  try {
    const result = await getExportDimensionPreview(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function downloadExportDimensionExcelController(req, res, next) {
  try {
    const report = await buildExportDimensionExcel({
      lotIds: req.body?.lotIds,
      topicNames: req.body?.topicNames
    });

    res.setHeader('Content-Type', report.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${report.fileName}"`);
    res.send(Buffer.from(report.buffer));
  } catch (error) {
    next(error);
  }
}
