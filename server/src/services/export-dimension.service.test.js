import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildExportDimensionWorkbookFromRows,
  buildExportDimensionPreviewFromRows,
  normalizeExportDimensionLotIds,
  normalizeExportDimensionPreviewFilters
} from './export-dimension.service.js';

const baseRow = {
  id: 1,
  lot_number: 'LOT-001',
  lot_pack_barcode: 'PACK-001',
  lot_packing: 'PROD-001',
  model_name: 'ABC123',
  dimension: 'Front pad',
  aci_grade: 'A',
  purchase_order: 'PO-001',
  production_date: '2026-06-01',
  quantity: 100,
  lot_status: 'approved',
  inspection_status: 'completed',
  inspection_date: '2026-06-02',
  inspector_name: 'QC Head',
  instrument_codes: JSON.stringify(['A-01-001', 'A-02-002']),
  form_config_snapshot: JSON.stringify([
    { id: 10, topicName: 'ความหนา', inputCount: 3, inputType: 'number' },
    { id: 11, topicName: 'ความกว้าง', inputCount: 2, inputType: 'number' },
    { id: 12, topicName: 'ผลรูยึด', inputCount: 1, inputType: 'pass_fail' },
    { id: 13, topicName: 'หัวข้อไม่มีค่า', inputCount: 1, inputType: 'number' }
  ]),
  pieces_data: JSON.stringify({
    topics: [
      {
        topicId: 10,
        topicName: 'ความหนา',
        rows: [
          { pieceNo: 1, values: ['10.20', '-', ''] },
          { pieceNo: 2, values: ['10.30', 'abc', '10.10'] }
        ]
      },
      {
        topicId: 11,
        topicName: 'ความกว้าง',
        rows: [
          { pieceNo: 1, values: ['40.1', '40.2'] }
        ]
      },
      {
        topicId: 12,
        topicName: 'ผลรูยึด',
        rows: [
          { pieceNo: 1, values: ['pass'] }
        ]
      }
    ]
  })
};

test('export dimension preview requires model or production date filter', () => {
  assert.throws(
    () => normalizeExportDimensionPreviewFilters({}),
    /รุ่น\/รายละเอียด หรือช่วงวันที่ผลิต/
  );

  assert.deepEqual(
    normalizeExportDimensionPreviewFilters({ model: 'ABC123' }).modelSearch,
    'ABC123'
  );
});

test('export dimension preview requires production date when model search is too short', () => {
  assert.throws(
    () => normalizeExportDimensionPreviewFilters({ model: 'AB' }),
    /ช่วงวันที่ผลิต/
  );

  const filters = normalizeExportDimensionPreviewFilters({
    model: 'AB',
    productionStartDate: '2026-06-01',
    productionEndDate: '2026-06-30'
  });

  assert.equal(filters.modelSearch, 'AB');
  assert.deepEqual(filters.productionDateRange, {
    startDate: '2026-06-01',
    endDate: '2026-06-30'
  });
});

test('export dimension preview counts numeric and skipped values from completed snapshots', () => {
  const result = buildExportDimensionPreviewFromRows([baseRow], {
    modelSearch: 'ABC123',
    productionDateRange: null,
    inspectionDateRange: null,
    topicNames: []
  });

  assert.equal(result.summary.totalLots, 1);
  assert.equal(result.summary.numericValueCount, 5);
  assert.equal(result.summary.skippedValueCount, 3);
  assert.deepEqual(
    result.availableTopics.map((topic) => topic.topicName).sort(),
    ['ความกว้าง', 'ความหนา']
  );
  assert.equal(result.items[0].topicCounts.length, 2);
  assert.equal(result.summary.snapshotInvalidCount, 0);
});

test('export dimension preview can count only selected measurement topics', () => {
  const result = buildExportDimensionPreviewFromRows([baseRow], {
    modelSearch: 'ABC123',
    productionDateRange: null,
    inspectionDateRange: null,
    topicNames: ['ความหนา']
  });

  assert.equal(result.summary.numericValueCount, 3);
  assert.equal(result.summary.skippedValueCount, 3);
  assert.deepEqual(result.topicSummary.map((topic) => topic.topicName), ['ความหนา']);
  assert.deepEqual(
    result.availableTopics.map((topic) => topic.topicName).sort(),
    ['ความกว้าง', 'ความหนา']
  );
});

test('export dimension preview reports invalid snapshots instead of hiding them', () => {
  const result = buildExportDimensionPreviewFromRows([{
    ...baseRow,
    pieces_data: '{bad json'
  }], {
    modelSearch: 'ABC123',
    productionDateRange: null,
    inspectionDateRange: null,
    topicNames: []
  });

  assert.equal(result.items[0].snapshotInvalid, true);
  assert.equal(result.summary.snapshotInvalidCount, 1);
  assert.equal(result.summary.numericValueCount, 0);
});

test('export dimension excel requires selected lot ids', () => {
  assert.throws(
    () => normalizeExportDimensionLotIds([]),
    /เลือก Lot อย่างน้อย 1 รายการ/
  );

  assert.throws(
    () => normalizeExportDimensionLotIds([1, 'bad']),
    /Lot ที่เลือกไม่ถูกต้อง/
  );

  assert.deepEqual(normalizeExportDimensionLotIds([1, '2', 2]), [1, 2]);
});

test('export dimension excel workbook creates raw, skipped, summary, and metadata sheets', () => {
  const { workbook, summary } = buildExportDimensionWorkbookFromRows([baseRow], {
    topicNames: ['ความหนา']
  });
  const rawSheet = workbook.getWorksheet('raw_data');
  const skippedSheet = workbook.getWorksheet('skipped_values');
  const metadataSheet = workbook.getWorksheet('metadata');

  assert.ok(rawSheet);
  assert.ok(skippedSheet);
  assert.ok(workbook.getWorksheet('summary'));
  assert.ok(metadataSheet);
  assert.equal(summary.numericValueCount, 3);
  assert.equal(summary.skippedValueCount, 3);
  assert.deepEqual(
    rawSheet.getColumn('measured_value').values.slice(2),
    [10.2, 10.3, 10.1]
  );
  assert.deepEqual(
    skippedSheet.getColumn('skip_reason').values.slice(2),
    ['dash', 'blank', 'not_numeric']
  );
  assert.equal(
    metadataSheet.getColumn(1).values.includes('exported_at') ||
      metadataSheet.getColumn(1).values.includes('exported_by') ||
      metadataSheet.getColumn(1).values.includes('exported_by_role'),
    false
  );
});

test('export dimension excel stops when snapshot is invalid', () => {
  assert.throws(
    () => buildExportDimensionWorkbookFromRows([{
      ...baseRow,
      pieces_data: '{bad json'
    }]),
    /snapshot/
  );
});

test('export dimension excel stops when instrument codes snapshot is invalid', () => {
  assert.throws(
    () => buildExportDimensionWorkbookFromRows([{
      ...baseRow,
      instrument_codes: '{bad json'
    }]),
    /snapshot/
  );
});

test('export dimension excel stops when measurement values exceed limit', () => {
  assert.throws(
    () => buildExportDimensionWorkbookFromRows([{
      ...baseRow,
      form_config_snapshot: JSON.stringify([
        { id: 10, topicName: 'ความหนา', inputCount: 50001, inputType: 'number' }
      ]),
      pieces_data: JSON.stringify({
        topics: [{
          topicId: 10,
          topicName: 'ความหนา',
          rows: [{
            pieceNo: 1,
            values: Array.from({ length: 50001 }, () => '10.20')
          }]
        }]
      })
    }]),
    /50000/
  );
});
