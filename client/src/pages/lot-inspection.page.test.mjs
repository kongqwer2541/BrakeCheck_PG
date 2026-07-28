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

const dimensionFormConfig = [
  {
    id: 1,
    topicName: 'Width',
    inputCount: 1,
    decimalPlaces: 2,
    inputType: 'number',
    measurePieces: 'all'
  },
  {
    id: 2,
    topicName: 'Length',
    inputCount: 1,
    decimalPlaces: 1,
    inputType: 'number',
    measurePieces: 'all'
  },
  {
    id: 3,
    topicName: 'Thickness',
    inputCount: 2,
    decimalPlaces: 2,
    inputType: 'number',
    measurePieces: 'all'
  },
  {
    id: 4,
    topicName: 'Final result',
    inputCount: 1,
    decimalPlaces: 0,
    inputType: 'pass_fail',
    measurePieces: 'all'
  }
];

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
  assert.equal(lotInspectionPage.requiresDimensionInspectionNote({
    meta: {
      inspectionNote: '',
      ngStop: { topicId: 2, topicName: 'Length' }
    },
    topics: [{ rows: [{ values: ['65.6'] }] }]
  }), true);
});

test('dimension NG details stay hidden until the final result is NG', () => {
  const html = renderLotInspectionPage({
    lot: {
      ...lot,
      status: 'pending',
      statusLabel: 'รอตรวจ'
    },
    formConfig: dimensionFormConfig,
    formValues: {
      sampleCount: 1,
      piecesData: {
        meta: { inspectionNote: '' },
        topics: []
      }
    },
    userRole: 'officer'
  });

  assert.doesNotMatch(html, /data-dimension-ng-stop-trigger/);
  assert.match(html, /<div[^>]*data-dimension-ng-topic-panel[^>]*hidden/);
  assert.match(html, /data-dimension-ng-topic[^>]*disabled/);
});

test('dimension NG details stay hidden when a stale NG topic remains after final result passes', () => {
  const html = renderLotInspectionPage({
    lot: {
      ...lot,
      status: 'pending',
      statusLabel: 'รอตรวจ'
    },
    formConfig: dimensionFormConfig,
    formValues: {
      sampleCount: 1,
      piecesData: {
        meta: {
          inspectionNote: '',
          ngStop: { topicId: 2, topicName: 'Length' }
        },
        topics: [
          {
            topicId: 4,
            topicName: 'Final result',
            rows: [{ pieceNo: 1, values: ['pass'] }]
          }
        ]
      }
    },
    userRole: 'officer'
  });

  assert.match(html, /<div[^>]*data-dimension-ng-topic-panel[^>]*hidden/);
  assert.match(html, /data-dimension-ng-topic[^>]*disabled/);
  assert.doesNotMatch(html, /value="2"[\s\S]*?selected/);
});

test('dimension final result stays identified when another pass-fail topic is ordered after it', () => {
  const reorderedConfig = [
    ...dimensionFormConfig,
    {
      id: 5,
      topicName: 'Surface condition',
      inputCount: 1,
      decimalPlaces: 0,
      inputType: 'pass_fail',
      measurePieces: 'all'
    }
  ];
  const html = renderLotInspectionPage({
    lot: {
      ...lot,
      status: 'pending',
      statusLabel: 'รอตรวจ'
    },
    formConfig: reorderedConfig,
    formValues: {
      sampleCount: 1,
      piecesData: {
        meta: {
          inspectionNote: 'Width is outside tolerance',
          ngStop: { topicId: 1, topicName: 'Width' }
        },
        topics: [
          {
            topicId: 1,
            topicName: 'Width',
            rows: [{ pieceNo: 1, values: ['10.00'] }]
          },
          {
            topicId: 4,
            topicName: 'Final result',
            rows: [{ pieceNo: 1, values: ['fail'] }]
          },
          {
            topicId: 5,
            topicName: 'Surface condition',
            rows: [{ pieceNo: 1, values: ['pass'] }]
          }
        ]
      }
    },
    userRole: 'officer'
  });

  assert.doesNotMatch(html, /<div[^>]*data-dimension-ng-topic-panel[^>]*hidden/);
  assert.match(
    html,
    /data-topic-name="Final result"[\s\S]*?data-final-result-topic="true"/
  );
  assert.doesNotMatch(
    html,
    /data-topic-name="Surface condition"[\s\S]*?data-final-result-topic="true"/
  );
});

test('dimension NG details show the selected cause and keep later blank topics editable', () => {
  const html = renderLotInspectionPage({
    lot: {
      ...lot,
      status: 'pending',
      statusLabel: 'รอตรวจ'
    },
    formConfig: dimensionFormConfig,
    formValues: {
      sampleCount: 1,
      piecesData: {
        meta: {
          inspectionNote: 'Length is outside tolerance',
          ngStop: {
            topicId: 2,
            topicName: 'Length'
          }
        },
        topics: [
          {
            topicId: 1,
            topicName: 'Width',
            rows: [{ pieceNo: 1, values: ['10.00'] }]
          },
          {
            topicId: 2,
            topicName: 'Length',
            rows: [{ pieceNo: 1, values: ['65.6'] }]
          },
          {
            topicId: 3,
            topicName: 'Thickness',
            rows: [{ pieceNo: 1, values: ['', ''] }]
          },
          {
            topicId: 4,
            topicName: 'Final result',
            rows: [{ pieceNo: 1, values: ['fail'] }]
          }
        ]
      }
    },
    userRole: 'officer'
  });

  assert.doesNotMatch(html, /<div[^>]*data-dimension-ng-topic-panel[^>]*hidden/);
  assert.match(html, /name="ngStopTopicId"[\s\S]*value="2"[\s\S]*?selected/);
  assert.match(html, /value="65.6"/);
  assert.doesNotMatch(html, /data-not-inspected="true"/);

  const topicSelectHtml = html.match(
    /<select[^>]*data-dimension-ng-topic[\s\S]*?<\/select>/
  )?.[0] || '';

  assert.doesNotMatch(topicSelectHtml, /value="4"/);
});

test('saved not-inspected values display as N/A without changing the NG topic values', () => {
  const html = renderLotInspectionPage({
    lot: {
      ...lot,
      status: 'pending',
      statusLabel: 'รอตรวจ'
    },
    formConfig: dimensionFormConfig,
    formValues: {
      sampleCount: 1,
      piecesData: {
        meta: {
          inspectionNote: 'Length is outside tolerance',
          ngStop: { topicId: 2, topicName: 'Length' }
        },
        topics: [
          {
            topicId: 1,
            topicName: 'Width',
            rows: [{ pieceNo: 1, values: ['10.00'] }]
          },
          {
            topicId: 2,
            topicName: 'Length',
            rows: [{ pieceNo: 1, values: ['65.6'] }]
          },
          {
            topicId: 3,
            topicName: 'Thickness',
            rows: [{ pieceNo: 1, values: ['-', '-'] }]
          },
          {
            topicId: 4,
            topicName: 'Final result',
            rows: [{ pieceNo: 1, values: ['fail'] }]
          }
        ]
      }
    },
    userRole: 'officer'
  });

  assert.match(html, /value="65.6"/);
  assert.match(html, /ไม่ได้ตรวจ \(N\/A\)/);
  assert.match(html, /data-not-inspected="true"/);
});

test('saved N/A values become editable blanks when completed NG work is sent back', () => {
  const html = renderLotInspectionPage({
    lot: {
      ...lot,
      status: 'need_fix',
      statusLabel: 'รอแก้ไข'
    },
    inspection: {
      status: 'completed'
    },
    formConfig: dimensionFormConfig,
    formValues: {
      sampleCount: 1,
      piecesData: {
        meta: {
          inspectionNote: 'Length is outside tolerance',
          ngStop: { topicId: 2, topicName: 'Length' }
        },
        topics: [
          {
            topicId: 1,
            topicName: 'Width',
            rows: [{ pieceNo: 1, values: ['10.00'] }]
          },
          {
            topicId: 2,
            topicName: 'Length',
            rows: [{ pieceNo: 1, values: ['65.6'] }]
          },
          {
            topicId: 3,
            topicName: 'Thickness',
            rows: [{ pieceNo: 1, values: ['-', '-'] }]
          },
          {
            topicId: 4,
            topicName: 'Final result',
            rows: [{ pieceNo: 1, values: ['fail'] }]
          }
        ]
      }
    },
    userRole: 'officer'
  });

  assert.match(html, /data-read-only="false"/);
  assert.doesNotMatch(html, /data-not-inspected="true"/);
  assert.match(
    html,
    /data-topic-name="Thickness"[\s\S]*?type="text"[\s\S]*?value=""/
  );
});

test('dimension NG completion requires the NG topic and any started later topic to be complete', () => {
  assert.equal(typeof lotInspectionPage.getRequiredMissingMeasurementInputs, 'function');

  const makeInput = (topicKey, value, inputType = 'number') => ({
    value,
    dataset: { topicKey, inputType }
  });
  const before = makeInput('1', '10.00');
  const ngMeasured = makeInput('2', '65.6');
  const ngMissing = makeInput('2', '');
  const laterMeasured = makeInput('3', '11.11');
  const laterMissing = makeInput('3', '');
  const untouchedLaterA = makeInput('5', '');
  const untouchedLaterB = makeInput('5', '');
  const finalResult = makeInput('4', 'fail', 'pass_fail');

  const missing = lotInspectionPage.getRequiredMissingMeasurementInputs([
    before,
    ngMeasured,
    ngMissing,
    laterMeasured,
    laterMissing,
    untouchedLaterA,
    untouchedLaterB,
    finalResult
  ], {
    ngStopTopicId: '2',
    finalResultTopicKey: '4'
  });

  assert.deepEqual(missing, [ngMissing, laterMissing]);
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
