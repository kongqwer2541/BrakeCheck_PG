export const reportColumnCount = 12;
export const sectionFill = 'FF1F4E79';
export const headerFill = 'FFEAF3FF';

const subsectionFill = 'FFD9EAF7';

export function addBlankRow(sheet) {
  sheet.addRow([]);
}

export function reportCellValue(value, fallback = '-') {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  const text = String(value);
  if (text === '-') {
    return text;
  }

  return /^[\s\t\r\n]*[=+\-@]/.test(text) ? `'${text}` : text;
}

export function addReportRow(sheet, values = []) {
  return sheet.addRow(values.map((value) => reportCellValue(value)));
}

export function setReportFill(cell, argb) {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb }
  };
}

export function setReportBorder(cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFD5DEE8' } },
    left: { style: 'thin', color: { argb: 'FFD5DEE8' } },
    bottom: { style: 'thin', color: { argb: 'FFD5DEE8' } },
    right: { style: 'thin', color: { argb: 'FFD5DEE8' } }
  };
}

export function styleReportCells(row, startCol, endCol, styleCallback) {
  for (let columnIndex = startCol; columnIndex <= endCol; columnIndex += 1) {
    styleCallback(row.getCell(columnIndex), columnIndex);
  }
}

export function addReportSectionTitle(sheet, title) {
  const row = addReportRow(sheet, [title]);
  sheet.mergeCells(row.number, 1, row.number, reportColumnCount);
  row.height = 22;
  const cell = row.getCell(1);
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 };
  cell.alignment = { vertical: 'middle' };
  setReportFill(cell, sectionFill);
  setReportBorder(cell);
}

export function addReportSubsectionTitle(sheet, title) {
  const row = addReportRow(sheet, [title]);
  sheet.mergeCells(row.number, 1, row.number, reportColumnCount);
  const cell = row.getCell(1);
  cell.font = { bold: true };
  setReportFill(cell, subsectionFill);
  setReportBorder(cell);
}

export function addReportKeyValueGrid(sheet, pairs, options = {}) {
  const pairsPerRow = options.pairsPerRow || 2;
  const span = Math.floor(reportColumnCount / pairsPerRow);

  for (let index = 0; index < pairs.length; index += pairsPerRow) {
    const row = addReportRow(sheet, []);

    for (let pairIndex = 0; pairIndex < pairsPerRow; pairIndex += 1) {
      const pair = pairs[index + pairIndex];
      const labelCol = pairIndex * span + 1;
      const valueStartCol = labelCol + 1;
      const valueEndCol = labelCol + span - 1;

      if (!pair) {
        continue;
      }

      row.getCell(labelCol).value = reportCellValue(pair[0]);
      row.getCell(labelCol).font = { bold: true };
      setReportFill(row.getCell(labelCol), headerFill);

      row.getCell(valueStartCol).value = reportCellValue(pair[1]);
      if (valueEndCol > valueStartCol) {
        sheet.mergeCells(row.number, valueStartCol, row.number, valueEndCol);
      }

      styleReportCells(row, labelCol, valueEndCol, (cell) => {
        cell.alignment = { vertical: 'top', wrapText: true };
        setReportBorder(cell);
      });
    }
  }
}

export function addReportSimpleTable(sheet, headers, rows) {
  const headerRow = addReportRow(sheet, headers);
  headerRow.font = { bold: true };
  styleReportCells(headerRow, 1, headers.length, (cell) => {
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    setReportFill(cell, headerFill);
    setReportBorder(cell);
  });

  if (!rows.length) {
    const emptyRow = addReportRow(sheet, ['ไม่มีข้อมูล']);
    sheet.mergeCells(emptyRow.number, 1, emptyRow.number, headers.length);
    styleReportCells(emptyRow, 1, headers.length, (cell) => {
      cell.alignment = { vertical: 'top', wrapText: true };
      setReportBorder(cell);
    });
    return;
  }

  rows.forEach((values) => {
    const row = addReportRow(sheet, values);
    styleReportCells(row, 1, headers.length, (cell) => {
      cell.alignment = { vertical: 'top', wrapText: true };
      setReportBorder(cell);
    });
  });
}

export function applySingleSheetReportStyle(sheet) {
  sheet.columns = Array.from({ length: reportColumnCount }, (_, index) => ({
    width: index === 0 ? 16 : 18
  }));

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = {
        vertical: cell.alignment?.vertical || 'top',
        horizontal: cell.alignment?.horizontal,
        wrapText: true
      };
    });
  });

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9
  };
}
