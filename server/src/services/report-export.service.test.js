import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';

import { db } from '../config/database.js';
import {
  assertReportExportAllLimit,
  assertReportReadyForExport,
  buildLotReportExcel,
  buildLotReportPdf,
  buildReportPackingRows,
  buildReportQueueLimitClause,
  getDimensionSummary,
  getPackingSummary,
  getReportExportLots,
  isReportExportTab,
  reportCellValue,
  sanitizeReportFileNamePart,
  validateReportLotNumber,
  validateReportExportTab
} from './report-export.service.js';

function inflatePdfContentStreams(buffer) {
  const text = buffer.toString('latin1');
  const streams = [...text.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)];

  return streams.flatMap((match) => {
    try {
      return [inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1')];
    } catch {
      return [];
    }
  });
}

function getPdfPageContentStreams(buffer) {
  return inflatePdfContentStreams(buffer).filter((content) => (
    content.includes('/DeviceRGB') && content.includes(' re')
  ));
}

function getFiveColumnHeaderRectYValues(buffer) {
  const content = inflatePdfContentStreams(buffer).join('\n');
  return [...content.matchAll(/^([0-9.]+) ([0-9.]+) 157\.178 20 re$/gm)]
    .slice(0, 5)
    .map((match) => Number(match[2]));
}

function getLowerPageKeyValueLabelRects(buffer) {
  const content = inflatePdfContentStreams(buffer).join('\n');
  return [...content.matchAll(/^([0-9.]+) ([0-9.]+) ([0-9.]+) ([0-9.]+) re$/gm)]
    .map((match) => ({
      y: Number(match[2]),
      width: Number(match[3]),
      height: Number(match[4])
    }))
    .filter((rect) => rect.y >= 200 && rect.width >= 90 && rect.width <= 140 && rect.height >= 20);
}

function assertSamePdfRow(yValues, message) {
  assert.equal(yValues.length, 5, 'ควรพบช่อง header ของตารางเครื่องมือวัดครบ 5 ช่อง');
  assert.equal(new Set(yValues).size, 1, message);
}

function pageHasSectionTitle(pageContent) {
  return /^28 [0-9.]+ 785\.89 22 re$/m.test(pageContent);
}

function pageHasApprovalKeyValueRows(pageContent) {
  return /^28 [0-9.]+ 110 [0-9.]+ re$/m.test(pageContent) &&
    /^420\.945 [0-9.]+ 110 [0-9.]+ re$/m.test(pageContent);
}

test('report export tabs allow only completed report groups', () => {
  assert.equal(isReportExportTab('approved'), true);
  assert.equal(isReportExportTab('confirmed_ng'), true);
  assert.equal(isReportExportTab('ng'), false);
  assert.equal(isReportExportTab('waiting_approve'), false);
});

test('report export tab defaults to approved', () => {
  assert.equal(validateReportExportTab(''), 'approved');
  assert.equal(validateReportExportTab('approved'), 'approved');
  assert.equal(validateReportExportTab('confirmed_ng'), 'confirmed_ng');
  assert.throws(() => validateReportExportTab('ng'), /แท็บส่งออกไม่ถูกต้อง/);
});

test('report export limit clause uses concrete numbers for mysql compatibility', () => {
  assert.equal(buildReportQueueLimitClause(50, 0), 'LIMIT 50 OFFSET 0');
  assert.equal(buildReportQueueLimitClause(50, 50), 'LIMIT 50 OFFSET 50');
  assert.equal(buildReportQueueLimitClause('all', 0), '');
  assert.doesNotMatch(buildReportQueueLimitClause(50, 0), /\?/);
});

test('report export all option is capped before loading every row', () => {
  assert.doesNotThrow(() => assertReportExportAllLimit({
    pageSize: 'all',
    totalItems: 1000
  }));

  assert.throws(
    () => assertReportExportAllLimit({ pageSize: 'all', totalItems: 1001 }),
    /1000/
  );

  assert.doesNotThrow(() => assertReportExportAllLimit({
    pageSize: 50,
    totalItems: 1001
  }));
});

test('report export rejects impossible production dates before querying', async () => {
  await assert.rejects(
    () => getReportExportLots({ date: '2026-99-99' }),
    /วันที่ผลิตไม่ถูกต้อง/
  );
});

test('report pdf export fails clearly when the Thai font is missing before querying data', async () => {
  const originalThaiFontPath = process.env.PDF_THAI_FONT_PATH;
  const originalGetConnection = db.getConnection;
  let queried = false;

  process.env.PDF_THAI_FONT_PATH = 'Z:\\missing\\brakecheck-thai-font.ttf';
  db.getConnection = async () => {
    queried = true;
    throw new Error('Database should not be queried when PDF Thai font is missing');
  };

  try {
    await assert.rejects(
      () => buildLotReportPdf({ lotNumber: 'LOT-PDF-1' }),
      (error) => {
        assert.equal(error.statusCode, 500);
        assert.match(error.message, /PDF_THAI_FONT_PATH/);
        return true;
      }
    );
    assert.equal(queried, false);
  } finally {
    if (originalThaiFontPath === undefined) {
      delete process.env.PDF_THAI_FONT_PATH;
    } else {
      process.env.PDF_THAI_FONT_PATH = originalThaiFontPath;
    }
    db.getConnection = originalGetConnection;
  }
});

test('report pdf export creates a pdf file from completed snapshot data', async () => {
  const originalGetConnection = db.getConnection;
  let released = false;
  const lotRow = {
    id: 1,
    lot_number: 'LOT-PDF-1',
    lot_pack_barcode: 'PACK-1',
    lot_packing: 'PROD-1',
    model_name: 'MODEL-A',
    dimension: '100x50',
    aci_grade: 'A',
    code: 'C-1',
    purchase_order: 'PO-1',
    production_date: '2026-06-20',
    quantity: 100,
    status: 'approved',
    dimension_status: 'completed',
    dimension_inspection_date: '2026-06-20',
    dimension_shift: '1',
    dimension_instrument_codes: JSON.stringify(['A-01', 'A-02', 'A-03']),
    dimension_rivet_no: 'R-1',
    dimension_production_code: 'P-1',
    dimension_brake_type: 'normal',
    dimension_brake_model: 'with_groove',
    dimension_rivet_hole_thickness: 2.5,
    dimension_sample_count: 2,
    dimension_form_config_snapshot: JSON.stringify([
      { id: 1, topicName: 'ความกว้าง', inputCount: 2, inputType: 'number' },
      { id: 2, topicName: 'สภาพทั่วไป', inputCount: 1, inputType: 'pass_fail' }
    ]),
    dimension_pieces_data: JSON.stringify({
      meta: {
        completedSavedByName: 'QC User',
        completedSavedAt: '2026-06-20T02:00:00.000Z',
        inspectionNote: 'ตรวจครบ'
      },
      topics: [
        { topicId: 1, topicName: 'ความกว้าง', rows: [{ pieceNo: 1, values: ['11.1', '11.2'] }] },
        { topicId: 2, topicName: 'สภาพทั่วไป', rows: [{ pieceNo: 1, values: ['pass'] }] }
      ]
    }),
    dimension_completed_at: '2026-06-20T02:00:00.000Z',
    dimension_completed_by_name: 'QC User',
    dimension_completed_by_position: 'QC',
    packing_status: 'completed',
    packing_inspection_date: '2026-06-20',
    packing_form_config_snapshot: JSON.stringify([
      { id: 1, topicName: 'ฉลาก', remark: 'ตรง Lot' }
    ]),
    packing_results_data: JSON.stringify({
      meta: {
        completedSavedByName: 'Pack User',
        completedSavedAt: '2026-06-20T03:00:00.000Z',
        packingReferenceValue: 'PROD-1',
        packingReferenceSourceLabel: 'Lot ผลิต',
        inspectionNote: ''
      },
      topics: [
        { topicId: 1, topicName: 'ฉลาก', referenceNote: 'ตรง Lot', value: 'pass' }
      ]
    }),
    packing_completed_at: '2026-06-20T03:00:00.000Z',
    packing_completed_by_name: 'Pack User',
    packing_completed_by_position: 'QC'
  };
  const fakeConnection = {
    execute: async (sql) => {
      if (sql.includes('FROM lots')) {
        return [[lotRow]];
      }

      if (sql.includes('FROM lot_audit_logs')) {
        return [[{
          action: 'approve',
          reason: 'ผ่าน',
          created_at: '2026-06-20T04:00:00.000Z',
          actor_name_snapshot: 'Head User',
          actor_position_snapshot: 'Head'
        }]];
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    release: () => {
      released = true;
    }
  };

  db.getConnection = async () => fakeConnection;

  try {
    const report = await buildLotReportPdf({ lotNumber: 'LOT-PDF-1' });

    assert.equal(report.mimeType, 'application/pdf');
    assert.match(report.fileName, /^BrakeCheck_Report_LOT-PDF-1_\d{4}-\d{2}-\d{2}\.pdf$/);
    assert.equal(report.buffer.subarray(0, 4).toString('utf8'), '%PDF');
    assertSamePdfRow(
      getFiveColumnHeaderRectYValues(report.buffer),
      'ช่อง header ของตารางเครื่องมือวัดใน PDF ต้องอยู่แถวเดียวกัน'
    );
    assert.ok(
      getLowerPageKeyValueLabelRects(report.buffer).some((rect) => rect.width > 100),
      'label ยาวใน PDF ต้องมีช่อง label กว้างพอให้อ่านครบ'
    );
    assert.equal(released, true);
  } finally {
    db.getConnection = originalGetConnection;
  }
});

test('report pdf keeps approval evidence title and rows on the same page', async () => {
  const originalGetConnection = db.getConnection;
  const longNote = '1151511515151515151515115115151 '.repeat(5);
  const dimensionTopics = Array.from({ length: 8 }, (_, index) => ({
    id: index + 1,
    topicName: `หัวข้อยาวสำหรับทดสอบหน้าแตก ${index + 1}`,
    inputCount: index < 4 ? 2 : 1,
    inputType: index < 6 ? 'number' : 'pass_fail'
  }));
  const lotRow = {
    id: 2,
    lot_number: 'LOT-SPLIT-1',
    lot_pack_barcode: 'PACK-1',
    lot_packing: 'PROD-1',
    model_name: 'MODEL-A',
    dimension: '100x50',
    aci_grade: 'A',
    code: 'C-1',
    purchase_order: 'PO-1',
    production_date: '2026-06-20',
    quantity: 100,
    status: 'approved',
    dimension_status: 'completed',
    dimension_inspection_date: '2026-06-20',
    dimension_shift: '1',
    dimension_instrument_codes: JSON.stringify(['A-01', 'A-02', 'A-03', 'A-04', 'A-05']),
    dimension_rivet_no: 'R-1',
    dimension_production_code: 'P-1',
    dimension_brake_type: 'normal',
    dimension_brake_model: 'with_groove',
    dimension_rivet_hole_thickness: 2.5,
    dimension_sample_count: 3,
    dimension_form_config_snapshot: JSON.stringify(dimensionTopics),
    dimension_pieces_data: JSON.stringify({
      meta: {
        completedSavedByName: 'QC User',
        completedSavedAt: '2026-06-20T02:00:00.000Z',
        inspectionNote: longNote
      },
      topics: dimensionTopics.map((topic) => ({
        topicId: topic.id,
        topicName: topic.topicName,
        rows: [1, 2, 3].map((pieceNo) => ({
          pieceNo,
          values: Array.from({ length: topic.inputCount }, () => (
            topic.inputType === 'pass_fail' ? 'pass' : '15.32'
          ))
        }))
      }))
    }),
    dimension_completed_at: '2026-06-20T02:00:00.000Z',
    dimension_completed_by_name: 'QC User',
    dimension_completed_by_position: 'QC',
    packing_status: 'completed',
    packing_inspection_date: '2026-06-20',
    packing_form_config_snapshot: JSON.stringify([
      { id: 1, topicName: 'ฉลาก', remark: 'ตรง Lot' },
      { id: 2, topicName: 'หัวข้อบรรจุยาว', remark: longNote }
    ]),
    packing_results_data: JSON.stringify({
      meta: {
        completedSavedByName: 'Pack User',
        completedSavedAt: '2026-06-20T03:00:00.000Z',
        packingReferenceValue: 'PROD-1',
        packingReferenceSourceLabel: 'Lot ผลิต',
        inspectionNote: longNote
      },
      topics: [
        { topicId: 1, topicName: 'ฉลาก', referenceNote: 'ตรง Lot', value: 'pass' },
        { topicId: 2, topicName: 'หัวข้อบรรจุยาว', referenceNote: longNote, value: 'pass' }
      ]
    }),
    packing_completed_at: '2026-06-20T03:00:00.000Z',
    packing_completed_by_name: 'Pack User',
    packing_completed_by_position: 'QC'
  };
  const fakeConnection = {
    execute: async (sql) => {
      if (sql.includes('FROM lots')) {
        return [[lotRow]];
      }

      if (sql.includes('FROM lot_audit_logs')) {
        return [[{
          action: 'approve',
          reason: 'อนุมัติ Lot',
          created_at: '2026-06-20T04:00:00.000Z',
          actor_name_snapshot: 'Head User',
          actor_position_snapshot: 'Head'
        }]];
      }

      throw new Error(`Unexpected query: ${sql}`);
    },
    release: () => {}
  };

  db.getConnection = async () => fakeConnection;

  try {
    const report = await buildLotReportPdf({ lotNumber: 'LOT-SPLIT-1' });
    const lastPage = getPdfPageContentStreams(report.buffer).at(-1);

    assert.equal(pageHasApprovalKeyValueRows(lastPage), true);
    assert.equal(pageHasSectionTitle(lastPage), true);
  } finally {
    db.getConnection = originalGetConnection;
  }
});

test('dimension summary counts saved fail cells without changing snapshot values', () => {
  assert.deepEqual(getDimensionSummary({
    topics: [
      { rows: [{ values: ['10.1', 'fail', '-'] }] },
      { rows: [{ values: ['', 'fail'] }] }
    ]
  }), {
    label: 'ไม่ผ่าน (พบ 2 จุด)',
    failCount: 2
  });

  assert.deepEqual(getDimensionSummary({
    topics: [{ rows: [{ values: ['10.1', '-'] }] }]
  }), {
    label: 'ผ่าน',
    failCount: 0
  });
});

test('packing summary counts failed topics and includes inspection note', () => {
  assert.deepEqual(getPackingSummary({
    meta: { inspectionNote: 'กล่องบุบ' },
    topics: [
      { topicName: 'สติกเกอร์', value: 'pass' },
      { topicName: 'จำนวน', value: 'fail' }
    ]
  }), {
    label: 'ไม่ผ่าน (พบ 1 หัวข้อ)',
    failCount: 1,
    note: 'กล่องบุบ'
  });

  assert.deepEqual(getPackingSummary({
    topics: [{ topicName: 'สติกเกอร์', value: 'pass' }]
  }), {
    label: 'ผ่าน',
    failCount: 0,
    note: ''
  });
});

test('report packing rows keep numeric topic values from snapshot', () => {
  assert.deepEqual(buildReportPackingRows(
    {
      topics: [
        { topicId: 1, topicName: 'Box weight', value: '12.50', inputType: 'number' },
        { topicId: 2, topicName: 'Label', value: 'pass', inputType: 'pass_fail' }
      ]
    },
    [
      { id: 1, topicName: 'Box weight', inputType: 'number', remark: 'kg' },
      { id: 2, topicName: 'Label', inputType: 'pass_fail', remark: 'visual' }
    ]
  ), [
    [1, 'Box weight', 'kg', '12.50'],
    [2, 'Label', 'visual', 'ผ่าน']
  ]);
});

test('report file name parts remove unsafe characters', () => {
  assert.equal(sanitizeReportFileNamePart('LOT/123:ABC'), 'LOT-123-ABC');
  assert.equal(sanitizeReportFileNamePart(''), 'report');
});

test('report excel cells keep plain dash but still escape formula-like text', () => {
  assert.equal(reportCellValue('-'), '-');
  assert.equal(reportCellValue('-1'), '\'-1');
  assert.equal(reportCellValue('=SUM(1,1)'), '\'=SUM(1,1)');
  assert.equal(reportCellValue('@HYPERLINK'), '\'@HYPERLINK');
});

test('report lot number validation matches Lot business key rules', () => {
  assert.equal(validateReportLotNumber('LOT-123'), 'LOT-123');
  assert.throws(
    () => validateReportLotNumber('LOT/123'),
    /Lot ใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข และขีดกลาง/
  );

  assert.throws(
    () => validateReportLotNumber('L'.repeat(21)),
    /Lot ต้องไม่เกิน 20 ตัวอักษร/
  );
});

function readyLot(overrides = {}) {
  return {
    status: 'approved',
    dimensionInspection: {
      status: 'completed',
      piecesData: { topics: [{ rows: [{ values: ['10.0'] }] }] },
      snapshotInvalid: false
    },
    packingInspection: {
      status: 'completed',
      resultsData: { topics: [{ value: 'pass' }] },
      snapshotInvalid: false
    },
    ...overrides
  };
}

test('report export requires approval evidence for approved lots', () => {
  assert.doesNotThrow(() => assertReportReadyForExport(
    readyLot(),
    { approved: { actorName: 'หัวหน้า' }, ngConfirmed: null }
  ));

  assert.throws(
    () => assertReportReadyForExport(readyLot(), { approved: null, ngConfirmed: null }),
    /ไม่พบหลักฐานการอนุมัติ/
  );
});

test('report export requires completed dimension and packing inspections', () => {
  assert.throws(
    () => assertReportReadyForExport(
      readyLot({ dimensionInspection: { status: 'draft', piecesData: { topics: [] }, snapshotInvalid: false } }),
      { approved: { actorName: 'หัวหน้า' }, ngConfirmed: null }
    ),
    /ใบตรวจมิติ/
  );

  assert.throws(
    () => assertReportReadyForExport(
      readyLot({ packingInspection: { status: 'draft', resultsData: { topics: [] }, snapshotInvalid: false } }),
      { approved: { actorName: 'หัวหน้า' }, ngConfirmed: null }
    ),
    /ใบตรวจบรรจุ/
  );
});

test('report export rejects invalid or empty completed snapshots', () => {
  assert.throws(
    () => assertReportReadyForExport(
      readyLot({ dimensionInspection: { status: 'completed', piecesData: { topics: [] }, snapshotInvalid: false } }),
      { approved: { actorName: 'หัวหน้า' }, ngConfirmed: null }
    ),
    /snapshot ใบตรวจมิติ/
  );

  assert.throws(
    () => assertReportReadyForExport(
      readyLot({ packingInspection: { status: 'completed', resultsData: { topics: [{ value: 'pass' }] }, snapshotInvalid: true } }),
      { approved: { actorName: 'หัวหน้า' }, ngConfirmed: null }
    ),
    /snapshot ใบตรวจบรรจุ/
  );
});
