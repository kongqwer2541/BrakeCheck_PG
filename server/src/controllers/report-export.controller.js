import {
  buildLotReportExcel,
  buildLotReportPdf,
  getReportExportLots
} from '../services/report-export.service.js';

export async function getReportExportLotsController(req, res, next) {
  try {
    const result = await getReportExportLots({
      tab: req.query.tab,
      date: req.query.date,
      search: req.query.search,
      page: req.query.page,
      pageSize: req.query.pageSize
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function downloadLotReportExcelController(req, res, next) {
  try {
    const report = await buildLotReportExcel({
      lotNumber: req.params.lotNumber
    });

    res.setHeader('Content-Type', report.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${report.fileName}"`);
    res.send(Buffer.from(report.buffer));
  } catch (error) {
    next(error);
  }
}

export async function downloadLotReportPdfController(req, res, next) {
  try {
    const report = await buildLotReportPdf({
      lotNumber: req.params.lotNumber
    });

    res.setHeader('Content-Type', report.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${report.fileName}"`);
    res.send(Buffer.from(report.buffer));
  } catch (error) {
    next(error);
  }
}
