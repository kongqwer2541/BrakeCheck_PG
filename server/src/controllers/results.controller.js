import { getResultsLots } from '../services/results.service.js';

export async function getResultsLotsController(req, res, next) {
  try {
    const result = await getResultsLots({
      tab: req.query.tab,
      dateMode: req.query.dateMode,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      search: req.query.search,
      page: req.query.page,
      pageSize: req.query.pageSize
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}
