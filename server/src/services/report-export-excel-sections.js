import ExcelJS from 'exceljs';

import {
  addBlankRow,
  addReportKeyValueGrid,
  addReportRow,
  addReportSectionTitle,
  addReportSimpleTable,
  addReportSubsectionTitle,
  applySingleSheetReportStyle,
  headerFill,
  reportColumnCount,
  sectionFill,
  setReportBorder,
  setReportFill,
  styleReportCells
} from './report-export-excel-layout.js';

function addReportDimensionMeasurementTable(sheet, title, topics, { deps, passFail = false } = {}) {
  const selectedTopics = topics.filter((topic) => (
    passFail ? topic.inputType === 'pass_fail' : topic.inputType !== 'pass_fail'
  ));
  const pieceNumbers = deps.getReportDimensionPieceNumbers(selectedTopics);

  addReportSubsectionTitle(sheet, title);

  if (!selectedTopics.length || !pieceNumbers.length) {
    addReportSimpleTable(sheet, ['ข้อมูล'], [['ไม่มีข้อมูล']]);
    return;
  }

  const columns = selectedTopics.flatMap((topic) => {
    const inputCount = passFail ? 1 : Math.max(1, Number(topic.inputCount || 1));
    return Array.from({ length: inputCount }, (_, inputIndex) => ({ topic, inputIndex }));
  });
  const headerRow1 = addReportRow(sheet, ['ชิ้นที่', ...columns.map(({ topic }) => topic.topicName || '-')]);
  const headerRow2 = addReportRow(sheet, ['', ...columns.map(({ inputIndex }) => (
    passFail ? 'ผล' : `ช่องที่ ${inputIndex + 1}`
  ))]);

  sheet.mergeCells(headerRow1.number, 1, headerRow2.number, 1);
  let col = 2;
  selectedTopics.forEach((topic) => {
    const inputCount = passFail ? 1 : Math.max(1, Number(topic.inputCount || 1));
    if (inputCount > 1) {
      sheet.mergeCells(headerRow1.number, col, headerRow1.number, col + inputCount - 1);
    }
    col += inputCount;
  });

  [headerRow1, headerRow2].forEach((row) => {
    styleReportCells(row, 1, columns.length + 1, (cell) => {
      cell.font = { bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      setReportFill(cell, headerFill);
      setReportBorder(cell);
    });
  });

  pieceNumbers.forEach((pieceNo) => {
    const rowValues = [
      `ชิ้นที่ ${pieceNo}`,
      ...columns.map(({ topic, inputIndex }) => {
        const value = deps.getReportDimensionValue(topic, pieceNo, inputIndex);
        return passFail ? deps.toReportPassFailText(value) : value || '-';
      })
    ];
    const row = addReportRow(sheet, rowValues);

    styleReportCells(row, 1, columns.length + 1, (cell, columnIndex) => {
      cell.alignment = {
        vertical: 'middle',
        horizontal: columnIndex === 1 ? 'left' : 'center',
        wrapText: true
      };
      setReportBorder(cell);
    });
  });
}

function addSingleSheetReportHeader(sheet, lot, deps) {
  const row = addReportRow(sheet, ['BrakeCheck Inspection Report']);
  sheet.mergeCells(row.number, 1, row.number, reportColumnCount);
  row.height = 28;
  const cell = row.getCell(1);
  cell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  cell.alignment = { vertical: 'middle', horizontal: 'center' };
  setReportFill(cell, sectionFill);
  setReportBorder(cell);

  addReportKeyValueGrid(sheet, [
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
    ['วันที่ Export', deps.toDateText(new Date())]
  ]);
}

function addSingleSheetDimensionSection(sheet, lot, deps) {
  const inspection = lot.dimensionInspection;
  const piecesData = inspection.piecesData || { topics: [] };
  const topics = deps.normalizeReportDimensionTopics(piecesData, inspection.formConfigSnapshot);
  const dimensionSummary = deps.getDimensionSummary(piecesData);

  addReportSectionTitle(sheet, 'ฟอร์มตรวจมิติ');
  addReportKeyValueGrid(sheet, [
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

  addReportSubsectionTitle(sheet, 'รหัสเครื่องมือวัด');
  addReportSimpleTable(
    sheet,
    ['เครื่องมือ 1', 'เครื่องมือ 2', 'เครื่องมือ 3', 'เครื่องมือ 4', 'เครื่องมือ 5'],
    [[
      ...(Array.isArray(inspection.instrumentCodes) ? inspection.instrumentCodes : [])
    ].concat(Array.from({ length: 5 }, () => '-')).slice(0, 5)]
  );

  addReportDimensionMeasurementTable(sheet, 'ค่าตัวเลข', topics, { deps, passFail: false });
  addReportDimensionMeasurementTable(sheet, 'ผลผ่าน / ไม่ผ่าน', topics, { deps, passFail: true });

  const note = deps.cleanText(piecesData?.meta?.inspectionNote);
  if (note) {
    addReportKeyValueGrid(sheet, [['หมายเหตุการตรวจมิติ', note]], { pairsPerRow: 1 });
  }
}

function addSingleSheetPackingSection(sheet, lot, deps) {
  const inspection = lot.packingInspection;

  addReportSectionTitle(sheet, 'ฟอร์มตรวจบรรจุ');

  if (lot.status === 'ng' && !inspection.status) {
    addReportKeyValueGrid(sheet, [
      ['สถานะ', 'ไม่ได้ตรวจบรรจุ'],
      ['เหตุผล', 'NG ตั้งแต่ตรวจมิติ']
    ], { pairsPerRow: 1 });
    return;
  }

  const resultsData = inspection.resultsData || { meta: {}, topics: [] };
  const packingSummary = deps.getPackingSummary(resultsData);

  addReportKeyValueGrid(sheet, [
    ['สถานะ', inspection.status || '-'],
    ['สรุปผล', packingSummary.label],
    ['วันที่ตรวจสอบ', inspection.inspectionDate],
    ['บันทึกสมบูรณ์โดย', deps.getReportInspectionSavedBy(inspection, 'resultsData')],
    ['เวลาบันทึกสมบูรณ์', deps.getReportInspectionSavedAt(inspection, 'resultsData')],
    ['Lot ผลิตที่ใช้อ้างอิง', resultsData?.meta?.packingReferenceValue || lot.lotPacking],
    ['แหล่งข้อมูลอ้างอิง', resultsData?.meta?.packingReferenceSourceLabel],
    ['หมายเหตุการตรวจบรรจุ', packingSummary.note]
  ]);

  addReportSubsectionTitle(sheet, 'หัวข้อการตรวจบรรจุ');
  addReportSimpleTable(
    sheet,
    ['ลำดับ', 'หัวข้อ', 'ค่าอ้างอิง/หมายเหตุ', 'ผล'],
    deps.buildReportPackingRows(resultsData, inspection.formConfigSnapshot)
  );
}

function addSingleSheetApprovalSection(sheet, lot, evidence, deps) {
  const isNg = lot.status === 'ng';
  const selectedEvidence = isNg ? evidence.ngConfirmed : evidence.approved;

  addReportSectionTitle(sheet, isNg ? 'หลักฐานรับทราบ NG' : 'หลักฐานอนุมัติ');
  addReportKeyValueGrid(sheet, [
    ['ผู้ดำเนินการ', selectedEvidence?.actorName],
    ['ตำแหน่ง', selectedEvidence?.actorPosition],
    ['วันที่', deps.toDateTimeText(selectedEvidence?.createdAt)],
    ['เหตุผล', selectedEvidence?.reason]
  ]);
}

export async function buildLotReportWorkbook({ lot, evidence, deps }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BrakeCheck';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('report');

  addSingleSheetReportHeader(sheet, lot, deps);
  addBlankRow(sheet);
  addSingleSheetDimensionSection(sheet, lot, deps);
  addBlankRow(sheet);
  addSingleSheetPackingSection(sheet, lot, deps);
  addBlankRow(sheet);
  addSingleSheetApprovalSection(sheet, lot, evidence, deps);
  applySingleSheetReportStyle(sheet);

  return workbook;
}
