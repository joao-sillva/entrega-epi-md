import { FILE_MIME_TYPES } from '../../config/constants.js';
import { unitsOf } from '../../domain/ppe-items.js';
import { formatDateTime } from '../../utils/date.js';
import { DOWNLOAD_DECLINED, saveFile } from '../../utils/file-download.js';
import { showErrorToast, showToast } from '../../ui/toast.js';
import { buildReportFileName, describeOutflowFilters, getFilteredOutflowEntries } from './outflow-filters.js';

const REPORT_TITLE = 'Relatório de saída de EPI – Moura Dubeux';

const LIBRARY_MISSING_HINT = 'A biblioteca não carregou. Verifique a conexão e tente de novo.';

const generatedLine = (entries) => {
  const units = entries.reduce((sum, entry) => sum + unitsOf(entry.quantityReceived), 0);
  return `Gerado em ${formatDateTime(new Date())} · ${entries.length} saída(s) · ${units} unidade(s)`;
};

/** Returns the entries to report, or null (with a notice) when there is nothing to download. */
function getEntriesOrWarn() {
  const entries = getFilteredOutflowEntries();
  if (entries.length) return entries;
  showErrorToast('Nada para baixar', 'Nenhuma saída encontrada com o filtro atual.');
  return null;
}

/* ---------- Excel ---------- */

const EXCEL_COLUMNS = [
  { title: 'Data e hora', width: 17, value: (entry) => formatDateTime(entry.deliveredAt) },
  { title: 'Funcionário', width: 28, value: (entry) => entry.employeeName },
  { title: 'Matrícula', width: 11, value: (entry) => entry.registrationNumber },
  { title: 'Função', width: 20, value: (entry) => entry.role },
  { title: 'Obra', width: 22, value: (entry) => entry.workSite },
  { title: 'EPI', width: 50, value: (entry) => entry.ppeName },
  { title: 'CA', width: 9, value: (entry) => String(entry.caNumber || '') },
  { title: 'Qtd. recebida', width: 13, value: (entry) => unitsOf(entry.quantityReceived) },
  { title: 'Qtd. devolvida', width: 14, value: (entry) => (entry.quantityReturned > 0 ? Number(entry.quantityReturned) : '') },
  { title: 'Código', width: 8, value: (entry) => entry.fillCode || '' },
];

export async function downloadOutflowExcel() {
  const entries = getEntriesOrWarn();
  if (!entries) return;
  if (!window.XLSX) {
    showErrorToast('Não foi possível gerar o Excel', LIBRARY_MISSING_HINT);
    return;
  }

  const fileName = buildReportFileName();
  const rows = [
    [REPORT_TITLE],
    [describeOutflowFilters()],
    [generatedLine(entries)],
    [],
    EXCEL_COLUMNS.map((column) => column.title),
    ...entries.map((entry) => EXCEL_COLUMNS.map((column) => column.value(entry))),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = EXCEL_COLUMNS.map((column) => ({ wch: column.width }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Saídas de EPI');

  try {
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const result = await saveFile(`${fileName}.xlsx`, new Blob([bytes], { type: FILE_MIME_TYPES.xlsx }), FILE_MIME_TYPES.xlsx);
    if (result !== DOWNLOAD_DECLINED) showToast('Relatório gerado', `${fileName}.xlsx`);
  } catch (error) {
    showErrorToast('Não foi possível gerar o Excel', 'Tente de novo.');
  }
}

/* ---------- PDF ---------- */

const PDF_MARGIN = 10;
const PDF_TABLE_WIDTH = 277;
const PDF_PAGE_BOTTOM = 200;
const PDF_HEADER_FILL = [238, 233, 229];
const PDF_ROW_LINE_COLOR = [220, 214, 210];
const PDF_LINE_HEIGHT = 3.6;
const PDF_ROW_PADDING = 2.4;
const PDF_COLUMNS = [
  { title: 'Data e hora', width: 28, value: (entry) => formatDateTime(entry.deliveredAt) },
  { title: 'Funcionário', width: 48, value: (entry) => entry.employeeName },
  { title: 'Obra', width: 36, value: (entry) => entry.workSite },
  { title: 'EPI', width: 113, value: (entry) => entry.ppeName },
  { title: 'CA', width: 16, value: (entry) => String(entry.caNumber || '') },
  { title: 'Qtd.', width: 12, value: (entry) => String(unitsOf(entry.quantityReceived)) },
  { title: 'Dev.', width: 12, value: (entry) => (entry.quantityReturned > 0 ? String(entry.quantityReturned) : '') },
  { title: 'Cód.', width: 12, value: (entry) => entry.fillCode || '' },
];

function drawPdfTitle(pdf, entries, y) {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text(REPORT_TITLE, PDF_MARGIN, y + 5);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(describeOutflowFilters(), PDF_MARGIN, y + 11);
  pdf.text(generatedLine(entries), PDF_MARGIN, y + 16);
  return y + 22;
}

function drawPdfTableHeader(pdf, y) {
  pdf.setFillColor(...PDF_HEADER_FILL);
  pdf.rect(PDF_MARGIN, y, PDF_TABLE_WIDTH, 7, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  let x = PDF_MARGIN;
  PDF_COLUMNS.forEach((column) => {
    pdf.text(column.title, x + 1.5, y + 4.7);
    x += column.width;
  });
  pdf.setFont('helvetica', 'normal');
  return y + 7;
}

function drawPdfPageNumbers(pdf) {
  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.text(`Página ${page} de ${pageCount}`, 287, 205, { align: 'right' });
  }
}

export async function downloadOutflowPdf() {
  const entries = getEntriesOrWarn();
  if (!entries) return;
  if (!(window.jspdf && window.jspdf.jsPDF)) {
    showErrorToast('Não foi possível gerar o PDF', LIBRARY_MISSING_HINT);
    return;
  }

  const fileName = buildReportFileName();
  try {
    const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    let y = drawPdfTitle(pdf, entries, PDF_MARGIN);
    y = drawPdfTableHeader(pdf, y);
    pdf.setFontSize(8);

    entries.forEach((entry) => {
      const cellLines = PDF_COLUMNS.map((column) => pdf.splitTextToSize(column.value(entry), column.width - 3));
      const rowHeight = Math.max(...cellLines.map((lines) => lines.length)) * PDF_LINE_HEIGHT + PDF_ROW_PADDING;
      if (y + rowHeight > PDF_PAGE_BOTTOM) {
        pdf.addPage();
        y = drawPdfTableHeader(pdf, PDF_MARGIN);
        pdf.setFontSize(8);
      }
      let x = PDF_MARGIN;
      cellLines.forEach((lines, columnIndex) => {
        pdf.text(lines, x + 1.5, y + 4);
        x += PDF_COLUMNS[columnIndex].width;
      });
      pdf.setDrawColor(...PDF_ROW_LINE_COLOR);
      pdf.line(PDF_MARGIN, y + rowHeight, PDF_MARGIN + PDF_TABLE_WIDTH, y + rowHeight);
      y += rowHeight;
    });
    drawPdfPageNumbers(pdf);

    const result = await saveFile(`${fileName}.pdf`, pdf.output('blob'), FILE_MIME_TYPES.pdf);
    if (result !== DOWNLOAD_DECLINED) showToast('Relatório gerado', `${fileName}.pdf`);
  } catch (error) {
    showErrorToast('Não foi possível gerar o PDF', 'Tente de novo.');
  }
}
