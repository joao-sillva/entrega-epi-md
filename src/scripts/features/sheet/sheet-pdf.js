import { FILE_MIME_TYPES, SHEET_DESIGN_WIDTH } from '../../config/constants.js';
import { saveFile } from '../../utils/file-download.js';
import { removeAccents } from '../../utils/text.js';
import { renderSheetMarkup } from './sheet-markup.js';

/** A4 printable area (mm) used for every sheet page. */
const PAGE = { width: 210, top: 10, maxWidth: 190, maxHeight: 277 };

export function createSheetPdf() {
  return new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
}

/** Draws one rendered sheet element as a page of the PDF (a new page after the first). */
export async function addSheetPage(pdf, element, isFirstPage) {
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
  let imageWidth = PAGE.maxWidth;
  let imageHeight = (canvas.height * PAGE.maxWidth) / canvas.width;
  if (imageHeight > PAGE.maxHeight) {
    imageWidth = (PAGE.maxWidth * PAGE.maxHeight) / imageHeight;
    imageHeight = PAGE.maxHeight;
  }
  if (!isFirstPage) pdf.addPage();
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (PAGE.width - imageWidth) / 2, PAGE.top, imageWidth, imageHeight);
}

const waitForImages = (element) => Promise.all([...element.querySelectorAll('img')].map((image) => (
  image.complete ? Promise.resolve() : new Promise((resolve) => {
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', resolve, { once: true });
  })
)));

/** Every sheet of the employee, oldest first: archived sheets, then the current one when it has entries. */
export function listEmployeeSheets(employee) {
  const sheets = [...employee.archivedSheets];
  if (employee.currentSheet.items.length || !sheets.length) sheets.push(employee.currentSheet);
  return sheets;
}

export const employeeSheetsFileName = (employee) => {
  const slug = removeAccents(employee.name).trim().replace(/\s+/g, '-').toLowerCase();
  return `fichas-epi-${slug}${employee.registrationNumber ? `-${String(employee.registrationNumber).replace(/[^\w-]+/g, '')}` : ''}.pdf`;
};

/**
 * Builds one PDF with all sheets of the employee (one page per sheet) and saves it.
 * Returns the result of `saveFile` (`true` or `DOWNLOAD_DECLINED`).
 */
export async function downloadEmployeeSheetsPdf(employee) {
  const holder = document.createElement('div');
  holder.style.cssText = `position:fixed;left:-10000px;top:0;width:${SHEET_DESIGN_WIDTH}px;pointer-events:none;`;
  holder.setAttribute('aria-hidden', 'true');
  document.body.appendChild(holder);
  try {
    const pdf = createSheetPdf();
    const sheets = listEmployeeSheets(employee);
    for (let position = 0; position < sheets.length; position += 1) {
      holder.innerHTML = `<div class="ppe-sheet">${renderSheetMarkup(employee, sheets[position])}</div>`;
      const sheetElement = holder.firstElementChild;
      await waitForImages(sheetElement);
      await addSheetPage(pdf, sheetElement, position === 0);
    }
    return await saveFile(employeeSheetsFileName(employee), pdf.output('blob'), FILE_MIME_TYPES.pdf);
  } finally {
    holder.remove();
  }
}
