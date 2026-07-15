import { pdfFont } from './report-export-pdf-fonts.js';

const pdfSectionColor = '#1F4E79';
const pdfSubsectionColor = '#D9EAF7';
const pdfHeaderColor = '#EAF3FF';
const pdfBorderColor = '#D5DEE8';
const pdfTextLineGap = 1;

function pdfText(value, fallback = '-') {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  return String(value);
}

export function ensurePdfSpace(doc, height) {
  if (!doc.page) {
    doc.addPage();
    return;
  }

  if (doc.y + height <= doc.page.height - doc.page.margins.bottom) {
    return;
  }

  doc.addPage();
}

export function addPdfSectionTitle(doc, title) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const height = 22;

  ensurePdfSpace(doc, height + 4);
  const startY = doc.y;

  doc.rect(x, startY, width, height).fill(pdfSectionColor);
  pdfFont(doc, true);
  doc.fillColor('white').fontSize(12).text(title, x + 8, startY + 4, {
    width: width - 16,
    height: height - 8
  });
  doc.fillColor('black');
  doc.y = startY + height + 4;
}

export function addPdfSubsectionTitle(doc, title) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const height = 20;

  ensurePdfSpace(doc, height + 4);
  const startY = doc.y;

  doc.rect(x, startY, width, height).fill(pdfSubsectionColor).stroke(pdfBorderColor);
  pdfFont(doc, true);
  doc.fillColor('black').fontSize(10).text(title, x + 6, startY + 4, {
    width: width - 12,
    height: height - 8
  });
  doc.y = startY + height + 4;
}

function getPdfKeyValueLabelWidth(pairsPerRow) {
  return pairsPerRow === 1 ? 132 : 110;
}

function getPdfKeyValuePairHeight(doc, pair, { pairWidth, labelWidth, padding }) {
  const valueWidth = pairWidth - labelWidth - padding * 2;
  pdfFont(doc, true);
  const labelHeight = doc.heightOfString(pdfText(pair?.[0]), {
    width: labelWidth - padding * 2,
    lineGap: pdfTextLineGap
  });
  pdfFont(doc, false);
  const valueHeight = doc.heightOfString(pdfText(pair?.[1]), {
    width: valueWidth,
    lineGap: pdfTextLineGap
  });

  return Math.max(
    20,
    labelHeight + padding * 2,
    valueHeight + padding * 2
  );
}

export function getPdfKeyValueGridHeight(doc, pairs, { pairsPerRow = 2 } = {}) {
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const pairWidth = width / pairsPerRow;
  const labelWidth = getPdfKeyValueLabelWidth(pairsPerRow);
  const padding = 4;
  let totalHeight = 4;

  for (let index = 0; index < pairs.length; index += pairsPerRow) {
    const rowPairs = pairs.slice(index, index + pairsPerRow);
    totalHeight += Math.max(...rowPairs.map((pair) => getPdfKeyValuePairHeight(doc, pair, {
      pairWidth,
      labelWidth,
      padding
    })));
  }

  return totalHeight;
}

export function addPdfKeyValueGrid(doc, pairs, { pairsPerRow = 2 } = {}) {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const pairWidth = width / pairsPerRow;
  const labelWidth = getPdfKeyValueLabelWidth(pairsPerRow);
  const padding = 4;

  for (let index = 0; index < pairs.length; index += pairsPerRow) {
    const rowPairs = pairs.slice(index, index + pairsPerRow);
    const rowHeight = Math.max(...rowPairs.map((pair) => getPdfKeyValuePairHeight(doc, pair, {
      pairWidth,
      labelWidth,
      padding
    })));

    ensurePdfSpace(doc, rowHeight);
    const rowY = doc.y;

    rowPairs.forEach((pair, pairIndex) => {
      const cellX = x + pairIndex * pairWidth;
      const valueX = cellX + labelWidth;
      const valueWidth = pairWidth - labelWidth;

      doc.rect(cellX, rowY, labelWidth, rowHeight).fill(pdfHeaderColor).stroke(pdfBorderColor);
      doc.rect(valueX, rowY, valueWidth, rowHeight).fill('white').stroke(pdfBorderColor);
      pdfFont(doc, true);
      doc.fillColor('black').fontSize(8).text(pdfText(pair?.[0]), cellX + padding, rowY + padding, {
        width: labelWidth - padding * 2,
        lineGap: pdfTextLineGap
      });
      pdfFont(doc, false);
      doc.fontSize(8).text(pdfText(pair?.[1]), valueX + padding, rowY + padding, {
        width: valueWidth - padding * 2,
        lineGap: pdfTextLineGap
      });
    });
    doc.y = rowY + rowHeight;
  }

  doc.y += 4;
}

function getPdfRowHeight(doc, row, widths, bold = false) {
  pdfFont(doc, bold);
  doc.fontSize(8);
  return Math.max(
    20,
    ...row.map((value, index) => (
      doc.heightOfString(pdfText(value), {
        width: (widths[index] || widths[0]) - 8,
        lineGap: pdfTextLineGap
      }) + 8
    ))
  );
}

export function addPdfTable(doc, headers, rows, widths) {
  const x = doc.page.margins.left;
  const drawRow = (values, { bold = false, fill = null, rowWidths = widths } = {}) => {
    const rowHeight = getPdfRowHeight(doc, values, rowWidths, bold);
    ensurePdfSpace(doc, rowHeight);
    const rowY = doc.y;
    let cellX = x;

    values.forEach((value, index) => {
      doc.rect(cellX, rowY, rowWidths[index], rowHeight).fill(fill || 'white').stroke(pdfBorderColor);
      pdfFont(doc, bold);
      doc.fillColor('black').fontSize(8).text(pdfText(value), cellX + 4, rowY + 4, {
        width: rowWidths[index] - 8,
        lineGap: pdfTextLineGap
      });
      cellX += rowWidths[index];
    });

    doc.y = rowY + rowHeight;
  };

  drawRow(headers, { bold: true, fill: pdfHeaderColor });

  if (!rows.length) {
    drawRow(['ไม่มีข้อมูล'], { bold: false, rowWidths: [widths.reduce((sum, width) => sum + width, 0)] });
    doc.y += 4;
    return;
  }

  rows.forEach((row) => drawRow(row));
  doc.y += 4;
}
