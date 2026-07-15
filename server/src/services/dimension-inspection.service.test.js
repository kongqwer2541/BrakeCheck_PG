import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canEditCompletedDimensionInspection,
  validateInstrumentCodes,
  shouldMeasurePiece,
  shouldSkipTopicByWorkType
} from './dimension-inspection.service.js';

test('hole inspection rule skips topics by rule_key without depending on Thai topic name', () => {
  const topic = {
    topicName: 'หัวข้อใหม่จาก Settings',
    ruleKey: 'hole_inspection'
  };

  assert.equal(shouldSkipTopicByWorkType(topic, { brakeType: 'normal', brakeModel: 'no_hole' }), true);
  assert.equal(shouldSkipTopicByWorkType(topic, { brakeType: 'sheet', brakeModel: 'drilled_bored' }), true);
  assert.equal(shouldSkipTopicByWorkType(topic, { brakeType: 'normal', brakeModel: 'drilled_bored' }), false);
});

test('hole inspection rule keeps Thai topic name fallback for old config data', () => {
  const topic = {
    topicName: 'ขนาดรูเจาะ/รูคว้าน'
  };

  assert.equal(shouldSkipTopicByWorkType(topic, { brakeType: 'sheet', brakeModel: 'drilled_bored' }), true);
});

test('custom measure pieces support comma list and ranges', () => {
  const topic = { measurePieces: '1,3-5' };

  assert.equal(shouldMeasurePiece(topic, 1), true);
  assert.equal(shouldMeasurePiece(topic, 2), false);
  assert.equal(shouldMeasurePiece(topic, 3), true);
  assert.equal(shouldMeasurePiece(topic, 5), true);
});

test('dimension instrument codes accept any A-00-000 code without slot prefix lock', () => {
  const codes = validateInstrumentCodes(
    ['A-02-111', 'A-03-111', 'A-05-111', '-', 'A-01-125'],
    true
  );

  assert.deepEqual(codes, ['A-02-111', 'A-03-111', 'A-05-111', '-', 'A-01-125']);
});

test('dimension instrument codes allow blank draft codes without internal error', () => {
  const codes = validateInstrumentCodes(
    ['A-02-111', '', null, '-', ''],
    false
  );

  assert.deepEqual(codes, ['A-02-111', '', '', '-', '']);
});

test('officer can edit a completed dimension inspection only after send back', () => {
  assert.equal(canEditCompletedDimensionInspection({ role: 'officer' }, 'waiting_approve'), false);
  assert.equal(canEditCompletedDimensionInspection({ role: 'officer' }, 'need_fix'), true);
  assert.equal(canEditCompletedDimensionInspection({ role: 'assistant' }, 'waiting_approve'), true);
  assert.equal(canEditCompletedDimensionInspection({ role: 'head' }, 'approved'), true);
});
