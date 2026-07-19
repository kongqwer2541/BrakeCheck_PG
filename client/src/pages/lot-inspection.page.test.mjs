import assert from 'node:assert/strict';
import test from 'node:test';

import * as lotInspectionPage from './lot-inspection.page.js';

const { renderLotInspectionPage } = lotInspectionPage;

const lot = {
  lotNumber: '260605002',
  lotPackBarcode: '260605002',
  lotPacking: '-',
  modelName: 'Isuzu CX 730 EX CX',
  code: 'Philippines',
  status: 'waiting_pack',
  statusLabel: 'รอตรวจบรรจุ'
};

test('dimension NG result requires an inspection note', () => {
  assert.equal(typeof lotInspectionPage.requiresDimensionInspectionNote, 'function');
  assert.equal(lotInspectionPage.requiresDimensionInspectionNote({
    meta: { inspectionNote: '' },
    topics: [{ rows: [{ values: ['fail'] }] }]
  }), true);
  assert.equal(lotInspectionPage.requiresDimensionInspectionNote({
    meta: { inspectionNote: 'Dimension is outside tolerance' },
    topics: [{ rows: [{ values: ['fail'] }] }]
  }), false);
});

test('packing error keeps a clear action back to the dimension form', () => {
  const html = renderLotInspectionPage({
    lot,
    activeTab: 'packing',
    error: 'Lot นี้ยังไม่มี Lot ผลิต หรือรหัสผลิตจากฟอร์มตรวจมิติ กรุณากลับไปบันทึกตรวจมิติก่อน'
  });

  assert.match(html, /กลับไปฟอร์มตรวจมิติ/);
  assert.match(html, /data-inspection-tab="dimension"/);
});

test('NG lot shows acknowledge action and acknowledgement evidence for head users', () => {
  const html = renderLotInspectionPage({
    lot: {
      ...lot,
      status: 'ng',
      statusLabel: 'NG',
      approvalEvidence: {
        ngConfirmed: {
          actorName: 'Manager User',
          actorPosition: 'หัวหน้าหน่วยควบคุมคุณภาพ',
          createdAt: '2026-06-19T10:30:00.000Z'
        }
      }
    },
    userRole: 'head'
  });

  assert.match(html, /data-approval-action="confirm_ng"/);
  assert.match(html, /Manager User/);
  assert.match(html, /หัวหน้าหน่วยควบคุมคุณภาพ/);
});

test('approved lot without audit evidence explains missing approval evidence', () => {
  const html = renderLotInspectionPage({
    lot: {
      ...lot,
      status: 'approved',
      statusLabel: 'Approved แล้ว',
      approvalEvidence: {}
    },
    userRole: 'head'
  });

  assert.match(html, /ไม่พบข้อมูลผู้อนุมัติใน audit log/);
});

test('empty and error states use the provided back label', () => {
  const emptyHtml = renderLotInspectionPage({
    backLabel: 'กลับไป Results'
  });
  const errorHtml = renderLotInspectionPage({
    error: 'ไม่พบ Lot นี้',
    backLabel: 'กลับไป Results'
  });

  assert.match(emptyHtml, /กลับไป Results/);
  assert.match(errorHtml, /กลับไป Results/);
  assert.doesNotMatch(emptyHtml, /กลับไปค้นหา Lot/);
  assert.doesNotMatch(errorHtml, /กลับไปค้นหา Lot/);
});

test('head users can see lot attachments upload and delete actions', () => {
  const html = renderLotInspectionPage({
    lot,
    userRole: 'head',
    attachments: [{
      id: 7,
      originalName: 'part-photo.jpg',
      fileSize: 1024,
      uploadedAt: '2026-06-19T10:30:00.000Z'
    }]
  });

  assert.match(html, /part-photo\.jpg/);
  assert.match(html, /data-attachment-upload/);
  assert.match(html, /data-delete-attachment-id="7"/);
});

test('officer users can upload and view lot attachments without delete actions', () => {
  const html = renderLotInspectionPage({
    lot,
    userRole: 'officer',
    attachments: [{
      id: 8,
      originalName: 'drawing.pdf',
      fileSize: 2048,
      uploadedAt: '2026-06-19T10:30:00.000Z'
    }]
  });

  assert.match(html, /drawing\.pdf/);
  assert.match(html, /data-attachment-upload/);
  assert.doesNotMatch(html, /data-delete-attachment-id/);
});

test('dimension form lets officers edit completed inspections sent back for fixing', () => {
  const html = renderLotInspectionPage({
    lot: {
      ...lot,
      status: 'need_fix',
      statusLabel: 'รอแก้ไข'
    },
    inspection: {
      status: 'completed'
    },
    formValues: {
      instrumentCodes: ['A-02-111', 'A-03-111', 'A-05-111', '-', 'A-01-125'],
      sampleCount: 1,
      piecesData: { topics: [] }
    },
    userRole: 'officer'
  });

  assert.match(html, /data-read-only="false"/);
  assert.match(html, /<strong>A-02-<\/strong>[\s\S]*name="instrumentCode0"[\s\S]*value="111"/);
  assert.match(html, /data-instrument-prefix="A-02-"/);
});

test('measurement Enter order completes every piece in one topic before the next topic', () => {
  assert.equal(typeof lotInspectionPage.sortMeasurementInputsByInspectionOrder, 'function');

  const createInput = (id, inputType, topicIndex, pieceNo, inputIndex) => ({
    id,
    dataset: {
      inputType,
      topicIndex: String(topicIndex),
      pieceNo: String(pieceNo),
      inputIndex: String(inputIndex)
    }
  });
  const inputsInTableOrder = [
    createInput('thickness-piece-1-point-1', 'number', 2, 1, 0),
    createInput('thickness-piece-1-point-2', 'number', 2, 1, 1),
    createInput('width-piece-1', 'number', 0, 1, 0),
    createInput('thickness-piece-2-point-1', 'number', 2, 2, 0),
    createInput('thickness-piece-2-point-2', 'number', 2, 2, 1),
    createInput('packing-piece-1', 'pass_fail', 1, 1, 0)
  ];

  const orderedIds = lotInspectionPage
    .sortMeasurementInputsByInspectionOrder(inputsInTableOrder)
    .map((input) => input.id);

  assert.deepEqual(orderedIds, [
    'width-piece-1',
    'thickness-piece-1-point-1',
    'thickness-piece-1-point-2',
    'thickness-piece-2-point-1',
    'thickness-piece-2-point-2',
    'packing-piece-1'
  ]);
});
