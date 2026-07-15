import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canEditCompletedPackingInspection,
  canSavePackingInspectionForLot,
  getNextLotStatusForPacking,
  getPackingReferenceFromInspection,
  getPackingReferenceFromLot,
  getPackingReferenceFromProductionCode,
  hasPackingFailResult,
  validatePackingResultsForComplete
} from './packing-inspection.service.js';

const formConfig = [
  { id: 1, topicName: 'เงื่อนไขการบรรจุ', inputType: 'pass_fail' },
  { id: 2, topicName: 'จำนวนชิ้น / ชุด', inputType: 'pass_fail' }
];

test('complete packing inspection requires every topic result', () => {
  assert.throws(
    () => validatePackingResultsForComplete({
      resultsData: {
        meta: { inspectionNote: '' },
        topics: [{ topicId: 1, topicName: 'เงื่อนไขการบรรจุ', value: 'pass' }]
      },
      formConfig
    }),
    /กรุณาเลือกผลตรวจ/
  );
});

test('packing numeric topics accept numeric values and do not count as fail', () => {
  const numericConfig = [
    { id: 1, topicName: 'Box weight', inputType: 'number', decimalPlaces: 2 }
  ];
  const resultsData = {
    meta: { inspectionNote: '' },
    topics: [{ topicId: 1, topicName: 'Box weight', value: '12.50' }]
  };

  assert.doesNotThrow(() => validatePackingResultsForComplete({
    resultsData,
    formConfig: numericConfig
  }));
  assert.equal(hasPackingFailResult(resultsData), false);
});

test('packing numeric topics reject values with too many decimals', () => {
  assert.throws(
    () => validatePackingResultsForComplete({
      resultsData: {
        meta: { inspectionNote: '' },
        topics: [{ topicId: 1, topicName: 'Box weight', value: '12.555' }]
      },
      formConfig: [{ id: 1, topicName: 'Box weight', inputType: 'number', decimalPlaces: 2 }]
    }),
    /Box weight/
  );
});

test('packing numeric topics require exact configured decimal places', () => {
  assert.throws(
    () => validatePackingResultsForComplete({
      resultsData: {
        meta: { inspectionNote: '' },
        topics: [{ topicId: 1, topicName: 'Box weight', value: '12.5' }]
      },
      formConfig: [{ id: 1, topicName: 'Box weight', inputType: 'number', decimalPlaces: 2 }]
    }),
    /Box weight/
  );

  assert.doesNotThrow(() => validatePackingResultsForComplete({
    resultsData: {
      meta: { inspectionNote: '' },
      topics: [{ topicId: 1, topicName: 'Box weight', value: '12.50' }]
    },
    formConfig: [{ id: 1, topicName: 'Box weight', inputType: 'number', decimalPlaces: 2 }]
  }));
});

test('complete packing inspection requires note when any topic fails', () => {
  assert.throws(
    () => validatePackingResultsForComplete({
      resultsData: {
        meta: { inspectionNote: '' },
        topics: [
          { topicId: 1, topicName: 'เงื่อนไขการบรรจุ', value: 'pass' },
          { topicId: 2, topicName: 'จำนวนชิ้น / ชุด', value: 'fail' }
        ]
      },
      formConfig
    }),
    /กรุณากรอกหมายเหตุ/
  );
});

test('packing status sends passing lots to approval and failing lots to ng', () => {
  const passing = {
    topics: [
      { topicId: 1, value: 'pass' },
      { topicId: 2, value: 'pass' }
    ]
  };
  const failing = {
    topics: [
      { topicId: 1, value: 'pass' },
      { topicId: 2, value: 'fail' }
    ]
  };

  assert.equal(hasPackingFailResult(passing), false);
  assert.equal(hasPackingFailResult(failing), true);
  assert.equal(getNextLotStatusForPacking('draft', passing), 'temp');
  assert.equal(getNextLotStatusForPacking('draft', failing), 'ng');
  assert.equal(getNextLotStatusForPacking('completed', passing), 'waiting_approve');
  assert.equal(getNextLotStatusForPacking('completed', failing), 'ng');
});

test('packing reference uses Lot ผลิต from Excel when available', () => {
  assert.equal(getPackingReferenceFromLot({ lot_packing: '-' }), null);
  assert.equal(getPackingReferenceFromLot({ lot_packing: '' }), null);
  assert.deepEqual(getPackingReferenceFromLot({ lot_packing: 'PACK-001' }), {
    value: 'PACK-001',
    source: 'lot_packing',
    sourceLabel: 'Lot ผลิตจาก Excel'
  });
});

test('packing reference falls back to production code from dimension inspection', () => {
  assert.equal(getPackingReferenceFromProductionCode('-'), null);
  assert.equal(getPackingReferenceFromProductionCode(''), null);
  assert.deepEqual(getPackingReferenceFromProductionCode(' 595658 '), {
    value: '595658',
    source: 'dimension_production_code',
    sourceLabel: 'รหัสผลิตจากฟอร์มตรวจมิติ'
  });
});

test('saved packing reference snapshot is readable from saved inspection data', () => {
  assert.deepEqual(getPackingReferenceFromInspection({
    results_data: JSON.stringify({
      meta: {
        packingReferenceValue: '595658',
        packingReferenceSource: 'dimension_production_code',
        packingReferenceSourceLabel: 'รหัสผลิตจากฟอร์มตรวจมิติ'
      },
      topics: []
    })
  }), {
    value: '595658',
    source: 'dimension_production_code',
    sourceLabel: 'รหัสผลิตจากฟอร์มตรวจมิติ'
  });
});

test('packing save is allowed only in the expected lot workflow states', () => {
  assert.equal(canSavePackingInspectionForLot({
    lotStatus: 'waiting_pack',
    inspectionStatus: null,
    userRole: 'officer'
  }), true);
  assert.equal(canSavePackingInspectionForLot({
    lotStatus: 'temp',
    inspectionStatus: 'draft',
    userRole: 'officer'
  }), true);
  assert.equal(canSavePackingInspectionForLot({
    lotStatus: 'ng',
    inspectionStatus: 'draft',
    userRole: 'officer'
  }), true);
  assert.equal(canSavePackingInspectionForLot({
    lotStatus: 'pending',
    inspectionStatus: null,
    userRole: 'officer'
  }), false);
});

test('completed packing inspection can be edited only by assistant or head', () => {
  assert.equal(canEditCompletedPackingInspection({ role: 'officer' }), false);
  assert.equal(canEditCompletedPackingInspection({ role: 'assistant' }), true);
  assert.equal(canEditCompletedPackingInspection({ role: 'head' }), true);
  assert.equal(canSavePackingInspectionForLot({
    lotStatus: 'waiting_approve',
    inspectionStatus: 'completed',
    userRole: 'officer'
  }), false);
  assert.equal(canSavePackingInspectionForLot({
    lotStatus: 'waiting_approve',
    inspectionStatus: 'completed',
    userRole: 'assistant'
  }), true);
});
