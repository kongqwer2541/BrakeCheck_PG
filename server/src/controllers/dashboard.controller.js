import { getDashboardData } from '../services/dashboard.service.js';

export async function getDashboard(req, res, next) {
  try {
    const result = await getDashboardData({
      date: req.query.date,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
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
