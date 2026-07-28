import {
  getQualitySummary,
  getQualitySummaryLots
} from '../services/summary.service.js';

export async function getQualitySummaryController(req, res, next) {
  try {
    res.json(await getQualitySummary({
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      modelSearch: req.query.modelSearch,
      grade: req.query.grade,
      topicSource: req.query.topicSource,
      years: req.query.years
    }));
  } catch (error) {
    next(error);
  }
}

export async function getQualitySummaryLotsController(req, res, next) {
  try {
    res.json(await getQualitySummaryLots({
      view: req.query.view,
      rankGroup: req.query.rankGroup,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      modelSearch: req.query.modelSearch,
      grade: req.query.grade,
      unfinishedStatus: req.query.unfinishedStatus,
      periodStart: req.query.periodStart,
      periodEnd: req.query.periodEnd,
      topicSource: req.query.topicSource,
      topicName: req.query.topicName,
      modelName: req.query.modelName,
      year: req.query.year,
      page: req.query.page,
      pageSize: req.query.pageSize
    }));
  } catch (error) {
    next(error);
  }
}
