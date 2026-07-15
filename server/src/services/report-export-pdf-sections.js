import { pdfFont } from './report-export-pdf-fonts.js';
import {
  addPdfKeyValueGrid,
  addPdfSectionTitle,
  addPdfSubsectionTitle,
  addPdfTable,
  ensurePdfSpace,
  getPdfKeyValueGridHeight
} from './report-export-pdf-layout.js';

const pdfReportHeaderColor = '#1F4E79';

function addPdfReportHeader(doc, lot, { toDateText }) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const height = 28;
  const startY = doc.y;

  doc.rect(x, startY, width, height).fill(pdfReportHeaderColor);
  pdfFont(doc, true);
  doc.fillColor('white').fontSize(15).text('BrakeCheck Inspection Report', x, startY + 6, {
    width,
    align: 'center'
  });
  doc.fillColor('black');
  doc.y = startY + height + 4;

  addPdfKeyValueGrid(doc, [
    ['Lot', lot.lotNumber],
    ['Lot Pack', lot.lotPackBarcode],
    ['Lot ผลิต', lot.lotPacking],
    ['สถานะ Lot', lot.statusLabel],
    ['Code', lot.code],
    ['รุ่น', lot.modelName],
    ['รายละเอียด', lot.dimension],
    ['เกรด', lot.aciGrade],
    ['จำนวน', lot.quantity],
    ['วันที่ผลิตจาก Excel / วันที่ฝน', lot.productionDate],
    ['ใบสั่งซื้อ', lot.purchaseOrder],
    ['วันที่ Export', toDateText(new Date())]
  ]);
}

function addPdfDimensionMeasurementTables(doc, title, topics, { passFail = false, getReportDimensionPieceNumbers, getReportDimensionValue, toReportPassFailText } = {}) {
  const selectedTopics = topics.filter((topic) => (
    passFail ? topic.inputType === 'pass_fail' : topic.inputType !== 'pass_fail'
  ));
  const pieceNumbers = getReportDimensionPieceNumbers(selectedTopics);

  addPdfSubsectionTitle(doc, title);

  if (!selectedTopics.length || !pieceNumbers.length) {
    addPdfTable(doc, ['ข้อมูล'], [['ไม่มีข้อมูล']], [doc.page.width - doc.page.margins.left - doc.page.margins.right]);
    return;
  }

  const columns = selectedTopics.flatMap((topic) => {
    const inputCount = passFail ? 1 : Math.max(1, Number(topic.inputCount || 1));
    return Array.from({ length: inputCount }, (_, inputIndex) => ({ topic, inputIndex }));
  });
  const chunkSize = 6;
  const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const pieceWidth = 62;

  for (let index = 0; index < columns.length; index += chunkSize) {
    const chunk = columns.slice(index, index + chunkSize);
    const valueWidth = (availableWidth - pieceWidth) / chunk.length;
    const widths = [pieceWidth, ...chunk.map(() => valueWidth)];
    const headers = [
      'ชิ้นที่',
      ...chunk.map(({ topic, inputIndex }) => (
        passFail ? topic.topicName || '-' : `${topic.topicName || '-'}\nช่องที่ ${inputIndex + 1}`
      ))
    ];
    const rows = pieceNumbers.map((pieceNo) => [
      `ชิ้นที่ ${pieceNo}`,
      ...chunk.map(({ topic, inputIndex }) => {
        const value = getReportDimensionValue(topic, pieceNo, inputIndex);
        return passFail ? toReportPassFailText(value) : value || '-';
      })
    ]);

    addPdfTable(doc, headers, rows, widths);
  }
}

function addPdfDimensionSection(doc, lot, deps) {
  const inspection = lot.dimensionInspection;
  const piecesData = inspection.piecesData || { topics: [] };
  const topics = deps.normalizeReportDimensionTopics(piecesData, inspection.formConfigSnapshot);
  const dimensionSummary = deps.getDimensionSummary(piecesData);

  addPdfSectionTitle(doc, 'ฟอร์มตรวจมิติ');
  addPdfKeyValueGrid(doc, [
    ['สถานะ', inspection.status || '-'],
    ['สรุปผล', dimensionSummary.label],
    ['วันที่ตรวจสอบ', inspection.inspectionDate],
    ['กะ', inspection.shift ? `กะ ${inspection.shift}` : '-'],
    ['Rivet No.', inspection.rivetNo],
    ['รหัสผลิต', inspection.productionCode],
    ['ประเภทผ้าเบรก', deps.getReportLabel(deps.brakeTypeLabels, inspection.brakeType)],
    ['แบบผ้าเบรก', deps.getReportLabel(deps.brakeModelLabels, inspection.brakeModel)],
    ['ขนาดความหนารูยึดรีเวท', inspection.rivetHoleThickness ? `${inspection.rivetHoleThickness} มม.` : '-'],
    ['จำนวนชิ้นงานสุ่มตรวจ', inspection.sampleCount],
    ['บันทึกสมบูรณ์โดย', deps.getReportInspectionSavedBy(inspection, 'piecesData')],
    ['เวลาบันทึกสมบูรณ์', deps.getReportInspectionSavedAt(inspection, 'piecesData')]
  ]);

  addPdfSubsectionTitle(doc, 'รหัสเครื่องมือวัด');
  const instrumentCodes = [
    ...(Array.isArray(inspection.instrumentCodes) ? inspection.instrumentCodes : [])
  ].concat(Array.from({ length: 5 }, () => '-')).slice(0, 5);
  const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  addPdfTable(
    doc,
    ['เครื่องมือ 1', 'เครื่องมือ 2', 'เครื่องมือ 3', 'เครื่องมือ 4', 'เครื่องมือ 5'],
    [instrumentCodes],
    Array.from({ length: 5 }, () => availableWidth / 5)
  );

  addPdfDimensionMeasurementTables(doc, 'ค่าตัวเลข', topics, { ...deps, passFail: false });
  addPdfDimensionMeasurementTables(doc, 'ผลผ่าน / ไม่ผ่าน', topics, { ...deps, passFail: true });

  const note = deps.cleanText(piecesData?.meta?.inspectionNote);
  if (note) {
    addPdfKeyValueGrid(doc, [['หมายเหตุการตรวจมิติ', note]], { pairsPerRow: 1 });
  }
}

function addPdfPackingSection(doc, lot, deps) {
  const inspection = lot.packingInspection;
  const resultsData = inspection.resultsData || { meta: {}, topics: [] };
  const packingSummary = deps.getPackingSummary(resultsData);
  const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  addPdfSectionTitle(doc, 'ฟอร์มตรวจบรรจุ');
  addPdfKeyValueGrid(doc, [
    ['สถานะ', inspection.status || '-'],
    ['สรุปผล', packingSummary.label],
    ['วันที่ตรวจสอบ', inspection.inspectionDate],
    ['บันทึกสมบูรณ์โดย', deps.getReportInspectionSavedBy(inspection, 'resultsData')],
    ['เวลาบันทึกสมบูรณ์', deps.getReportInspectionSavedAt(inspection, 'resultsData')],
    ['Lot ผลิตที่ใช้อ้างอิง', resultsData?.meta?.packingReferenceValue || lot.lotPacking],
    ['แหล่งข้อมูลอ้างอิง', resultsData?.meta?.packingReferenceSourceLabel],
    ['หมายเหตุการตรวจบรรจุ', packingSummary.note]
  ]);

  addPdfSubsectionTitle(doc, 'หัวข้อการตรวจบรรจุ');
  addPdfTable(
    doc,
    ['ลำดับ', 'หัวข้อ', 'ค่าอ้างอิง/หมายเหตุ', 'ผล'],
    deps.buildReportPackingRows(resultsData, inspection.formConfigSnapshot),
    [42, availableWidth * 0.32, availableWidth * 0.44, availableWidth - 42 - (availableWidth * 0.32) - (availableWidth * 0.44)]
  );
}

function addPdfApprovalSection(doc, lot, evidence, deps) {
  const isNg = lot.status === 'ng';
  const selectedEvidence = isNg ? evidence.ngConfirmed : evidence.approved;
  const pairs = [
    ['ผู้ดำเนินการ', selectedEvidence?.actorName],
    ['ตำแหน่ง', selectedEvidence?.actorPosition],
    ['วันที่', deps.toDateTimeText(selectedEvidence?.createdAt)],
    ['เหตุผล', selectedEvidence?.reason]
  ];

  ensurePdfSpace(doc, 22 + 4 + getPdfKeyValueGridHeight(doc, pairs));
  addPdfSectionTitle(doc, isNg ? 'หลักฐานรับทราบ NG' : 'หลักฐานอนุมัติ');
  addPdfKeyValueGrid(doc, pairs);
}

export function addPdfReportSections(doc, { lot, evidence, deps }) {
  addPdfReportHeader(doc, lot, deps);
  addPdfDimensionSection(doc, lot, deps);
  addPdfPackingSection(doc, lot, deps);
  addPdfApprovalSection(doc, lot, evidence, deps);
}
