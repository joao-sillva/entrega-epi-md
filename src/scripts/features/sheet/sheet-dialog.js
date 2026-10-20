import { FILE_MIME_TYPES, SHEET_DESIGN_WIDTH } from '../../config/constants.js';
import { appData, getSheet } from '../../state/app-data.js';
import { byId, closeDialog, showDialog } from '../../utils/dom.js';
import { saveFile } from '../../utils/file-download.js';
import { removeAccents } from '../../utils/text.js';
import { renderSheetMarkup } from './sheet-markup.js';

let sheetFileName = 'ficha-epi';

/** Opens the sheet dialog for the current sheet, or for the archived sheet at `archivedIndex`. */
export function openSheet(employeeIndex, archivedIndex) {
  const employee = appData.employees[employeeIndex];
  const sheet = getSheet(employee, archivedIndex);
  byId('sheet-body').innerHTML = renderSheetMarkup(employee, sheet);

  const employeeSlug = removeAccents(employee.name).replace(/\s+/g, '-').toLowerCase();
  sheetFileName = `ficha-epi-${employeeSlug}${archivedIndex === undefined ? '' : `-ficha-${archivedIndex + 1}`}`;
  byId('sheet-message').textContent = '';
  showDialog('sheet-dialog');
  byId('sheet-dialog').scrollTop = 0;
  fitSheetToScreen();
}

/** Scales the sheet down (keeping its layout) when the screen is narrower than the sheet. */
export function fitSheetToScreen() {
  const scaler = byId('sheet-scaler');
  const body = byId('sheet-body');
  if (!byId('sheet-dialog').open) return;

  body.style.width = '';
  body.style.transform = '';
  scaler.style.height = '';
  const availableWidth = scaler.clientWidth;
  if (!availableWidth || availableWidth >= SHEET_DESIGN_WIDTH) return;

  const scale = availableWidth / SHEET_DESIGN_WIDTH;
  body.style.width = `${SHEET_DESIGN_WIDTH}px`;
  body.style.transformOrigin = '0 0';
  body.style.transform = `scale(${scale})`;
  scaler.style.height = `${Math.ceil(body.offsetHeight * scale)}px`;
}

export async function exportSheetPdf() {
  const message = byId('sheet-message');
  message.style.color = '#c0392b';
  message.textContent = '';
  try {
    const body = byId('sheet-body');
    const previousTransform = body.style.transform;
    body.style.transform = '';
    let canvas;
    try {
      canvas = await html2canvas(body, { scale: 2, backgroundColor: '#ffffff' });
    } finally {
      body.style.transform = previousTransform;
    }

    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    const maxWidth = 190;
    const maxHeight = 277;
    let imageWidth = maxWidth;
    let imageHeight = (canvas.height * maxWidth) / canvas.width;
    if (imageHeight > maxHeight) {
      imageWidth = (maxWidth * maxHeight) / imageHeight;
      imageHeight = maxHeight;
    }
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', (210 - imageWidth) / 2, 10, imageWidth, imageHeight);
    await saveFile(`${sheetFileName}.pdf`, pdf.output('blob'), FILE_MIME_TYPES.pdf);
  } catch (error) {
    message.textContent = 'Não foi possível gerar o PDF. Use Imprimir e escolha "Salvar como PDF".';
  }
}

/* ---------- Printing ---------- */

const PRINT_FALLBACK_DELAY_MS = 700;

function preparePrintArea() {
  if (!byId('sheet-dialog').open) return;
  byId('print-area').innerHTML = `<div class="ppe-sheet">${byId('sheet-body').innerHTML}</div>`;
  document.documentElement.classList.add('is-printing-sheet');
}

function clearPrintArea() {
  document.documentElement.classList.remove('is-printing-sheet');
  byId('print-area').innerHTML = '';
}

/** Prints the sheet; when the browser cannot print here, a PDF is generated instead. */
export function printSheet() {
  preparePrintArea();
  let printDialogOpened = false;
  const markPrintStarted = () => { printDialogOpened = true; };
  window.addEventListener('beforeprint', markPrintStarted, { once: true });
  try {
    window.print();
  } catch (error) {
    // Handled by the fallback below.
  }
  setTimeout(() => {
    window.removeEventListener('beforeprint', markPrintStarted);
    if (printDialogOpened) return;
    clearPrintArea();
    exportSheetPdf();
    const message = byId('sheet-message');
    message.style.color = 'var(--color-muted)';
    message.textContent = 'A impressão direta não está disponível aqui. Gerei o PDF da ficha: salve e imprima o arquivo.';
  }, PRINT_FALLBACK_DELAY_MS);
}

export function bindSheetDialogEvents() {
  window.addEventListener('beforeprint', preparePrintArea);
  window.addEventListener('afterprint', clearPrintArea);
  window.addEventListener('resize', fitSheetToScreen);
}

export const closeSheetDialog = () => closeDialog('sheet-dialog');
