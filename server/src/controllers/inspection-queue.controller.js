import { getInspectionQueue } from '../services/inspection-queue.service.js';

export async function getInspectionQueueController(req, res, next) {
  try {
    const result = await getInspectionQueue({
      queueType: req.params.queueType,
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
