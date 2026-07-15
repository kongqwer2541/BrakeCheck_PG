import {
  getAuditHistory,
  getImportHistory,
  getLotHistory
} from '../services/history.service.js';

export async function getLotHistoryController(req, res, next) {
  try {
    const result = await getLotHistory({
      date: req.query.date,
      status: req.query.status,
      search: req.query.search,
      page: req.query.page,
      pageSize: req.query.pageSize
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getImportHistoryController(req, res, next) {
  try {
    const result = await getImportHistory({
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

export async function getAuditHistoryController(req, res, next) {
  try {
    const result = await getAuditHistory({
      date: req.query.date,
      action: req.query.action,
      search: req.query.search,
      page: req.query.page,
      pageSize: req.query.pageSize
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}
