import { appData } from '../../state/app-data.js';
import { commitChanges } from '../../state/change-notifier.js';
import { countDeliveredItems } from '../../domain/ppe-items.js';
import { byId, closeDialog, setMessage, showDialog } from '../../utils/dom.js';
import { DOWNLOAD_DECLINED } from '../../utils/file-download.js';
import { closeAllMenus } from '../../ui/dropdown-menu.js';
import { downloadEmployeeSheetsPdf, employeeSheetsFileName, listEmployeeSheets } from '../sheet/sheet-pdf.js';

/** The employee shown in the dialog (by reference: indexes change when the list is re-sorted). */
let employeeToDelete = null;
/** Set only after the PDF with every sheet of `employeeToDelete` was saved. */
let sheetsDownloaded = false;

const plural = (count, singular, pluralForm) => (count === 1 ? singular : pluralForm);

function setDeleteAllowed(isAllowed) {
  byId('delete-confirm-button').disabled = !isAllowed;
}

/**
 * An employee who already received PPE can only be deleted after the PDF with
 * all of their sheets is downloaded: the sheet is the legal record of the deliveries.
 */
export function askToDeleteEmployee(employeeIndex) {
  closeAllMenus();
  const employee = appData.employees[employeeIndex];
  employeeToDelete = employee;
  sheetsDownloaded = false;
  const deliveredCount = countDeliveredItems(employee);
  setMessage('delete-dialog-message', '');

  if (deliveredCount) {
    const sheetCount = listEmployeeSheets(employee).length;
    byId('delete-dialog-title').textContent = 'Baixe a ficha antes de excluir';
    byId('delete-dialog-text').textContent = `${employee.name} já recebeu ${deliveredCount} ${plural(deliveredCount, 'EPI', 'EPIs')}. `
      + `A ficha é o registro dessas entregas: baixe o PDF com ${plural(sheetCount, 'a ficha', `as ${sheetCount} fichas`)} e guarde o arquivo. `
      + 'Depois do download, o botão Excluir é liberado. As entregas dele também saem do histórico do Dashboard.';
    byId('delete-download-button').hidden = false;
    byId('delete-download-button').disabled = false;
    setDeleteAllowed(false);
  } else {
    byId('delete-dialog-title').textContent = 'Excluir funcionário';
    byId('delete-dialog-text').textContent = `Excluir ${employee.name}? A ficha de EPI dele também será apagada.`;
    byId('delete-download-button').hidden = true;
    setDeleteAllowed(true);
  }
  showDialog('delete-dialog');
}

export async function downloadSheetsBeforeDelete() {
  const employee = employeeToDelete;
  if (!employee) return;
  const button = byId('delete-download-button');
  button.disabled = true;
  setMessage('delete-dialog-message', 'Gerando o PDF da ficha…', 'var(--color-muted)');
  try {
    const result = await downloadEmployeeSheetsPdf(employee);
    if (employee !== employeeToDelete) return;
    if (result === DOWNLOAD_DECLINED) {
      setMessage('delete-dialog-message', 'O download foi cancelado. Baixe a ficha para liberar a exclusão.', 'var(--color-error-text)');
      return;
    }
    sheetsDownloaded = true;
    setDeleteAllowed(true);
    setMessage('delete-dialog-message', `Ficha baixada (${employeeSheetsFileName(employee)}). Confira o arquivo e clique em Excluir.`, 'var(--color-success)');
  } catch (error) {
    setMessage('delete-dialog-message', 'Não foi possível gerar o PDF da ficha. Tente de novo.', 'var(--color-error-text)');
  } finally {
    button.disabled = false;
  }
}

/** Signature and photo keys referenced by the sheets of an employee. */
function collectMediaIds(employee) {
  const signatureIds = new Set();
  const photoIds = new Set();
  [employee.currentSheet, ...employee.archivedSheets].forEach((sheet) => {
    if (sheet.technicianSignature && sheet.technicianSignature.signatureId) signatureIds.add(sheet.technicianSignature.signatureId);
    sheet.items.forEach((item) => {
      if (item.signatureId) signatureIds.add(item.signatureId);
      if (item.photoId) photoIds.add(item.photoId);
    });
  });
  return { signatureIds, photoIds };
}

/** Frees the signatures and photos of a deleted employee that no one else uses. */
function removeMediaOf(deletedEmployee) {
  const deleted = collectMediaIds(deletedEmployee);
  const stillUsed = appData.employees.map(collectMediaIds);
  const isUsed = (kind, id) => stillUsed.some((media) => media[kind].has(id));
  deleted.signatureIds.forEach((id) => { if (!isUsed('signatureIds', id)) delete appData.signatures[id]; });
  deleted.photoIds.forEach((id) => { if (!isUsed('photoIds', id)) delete appData.photos[id]; });
}

export function confirmDeleteEmployee() {
  const employee = employeeToDelete;
  const employeeIndex = appData.employees.indexOf(employee);
  if (employeeIndex < 0) return;
  if (countDeliveredItems(employee) && !sheetsDownloaded) return;
  appData.employees.splice(employeeIndex, 1);
  removeMediaOf(employee);
  employeeToDelete = null;
  sheetsDownloaded = false;
  commitChanges();
  closeDialog('delete-dialog');
}
