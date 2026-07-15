import {
  createInspectionTopic,
  deactivateInspectionTopic,
  getSystemSettings,
  updateInstrumentPrefixes,
  updateInspectionTopicDisplay,
  updateInspectionTopicDisplays,
  updateSamplingRules
} from '../services/settings.service.js';

export async function getSystemSettingsController(req, res, next) {
  try {
    res.json(await getSystemSettings());
  } catch (error) {
    next(error);
  }
}

export async function createInspectionTopicController(req, res, next) {
  try {
    res.status(201).json(await createInspectionTopic({
      formType: req.body?.formType,
      input: req.body,
      user: req.user
    }));
  } catch (error) {
    next(error);
  }
}

export async function updateInspectionTopicDisplayController(req, res, next) {
  try {
    res.json(await updateInspectionTopicDisplay({
      topicId: req.params.topicId,
      input: req.body,
      user: req.user
    }));
  } catch (error) {
    next(error);
  }
}

export async function updateInspectionTopicDisplaysController(req, res, next) {
  try {
    res.json(await updateInspectionTopicDisplays({
      items: req.body?.items,
      user: req.user
    }));
  } catch (error) {
    next(error);
  }
}

export async function deactivateInspectionTopicController(req, res, next) {
  try {
    res.json(await deactivateInspectionTopic({
      topicId: req.params.topicId,
      input: req.body,
      user: req.user
    }));
  } catch (error) {
    next(error);
  }
}

export async function updateSamplingRulesController(req, res, next) {
  try {
    res.json(await updateSamplingRules({
      rules: req.body?.rules,
      reason: req.body?.reason,
      user: req.user
    }));
  } catch (error) {
    next(error);
  }
}

export async function updateInstrumentPrefixesController(req, res, next) {
  try {
    res.json(await updateInstrumentPrefixes({
      prefixes: req.body?.prefixes,
      reason: req.body?.reason,
      user: req.user
    }));
  } catch (error) {
    next(error);
  }
}
