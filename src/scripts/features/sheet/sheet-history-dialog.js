import { SIGNER_ROLE_LABEL } from '../../config/constants.js';
import { appData } from '../../state/app-data.js';
import { onAppDataChanged } from '../../state/change-notifier.js';
import { getPendingSignerRole } from '../../domain/ppe-items.js';
import { byId, showDialog } from '../../utils/dom.js';
import { closeAllMenus } from '../../ui/dropdown-menu.js';

let employeeIndexShown = null;

function renderSheetHistoryItem(sheet, archivedIndex, employeeIndex) {
  const pendingRole = getPendingSignerRole(sheet);
  const pendingLabel = pendingRole ? SIGNER_ROLE_LABEL[pendingRole] : '';
  const itemCount = sheet.items.length;
  return `
    <div class="sheet-history-item">
      <div>
        <b>Ficha ${archivedIndex + 1}</b>
        <span>${sheet.archivedOn} · ${itemCount} EPI${itemCount === 1 ? '' : 's'}</span>
        ${pendingLabel ? `<span class="sheet-history-item__warning">⚠ Assinatura do ${pendingLabel} pendente</span>` : ''}
      </div>
      <div class="sheet-history-item__buttons">
        ${pendingLabel ? `<button type="button" class="button--warning" data-action="sign-archived-sheet" data-employee-index="${employeeIndex}" data-sheet-index="${archivedIndex}">Assinar</button>` : ''}
        <button type="button" class="button--soft" data-action="open-sheet" data-employee-index="${employeeIndex}" data-sheet-index="${archivedIndex}">Ver ficha</button>
      </div>
    </div>`;
}

function renderSheetHistory() {
  const employee = appData.employees[employeeIndexShown];
  byId('sheet-history-title').textContent = `Histórico de fichas · ${employee.name}`;
  const items = employee.archivedSheets
    .map((sheet, archivedIndex) => renderSheetHistoryItem(sheet, archivedIndex, employeeIndexShown))
    .reverse()
    .join('');
  byId('sheet-history-body').innerHTML = `<div class="sheet-history-list">${items || '<p>Nenhuma ficha arquivada ainda.</p>'}</div>`;
}

export function openSheetHistory(employeeIndex) {
  closeAllMenus();
  employeeIndexShown = employeeIndex;
  renderSheetHistory();
  showDialog('sheet-history-dialog');
}

/** Keeps the list up to date when a signature is added while the dialog is open. */
export function bindSheetHistoryEvents() {
  onAppDataChanged(() => {
    if (byId('sheet-history-dialog').open && appData.employees[employeeIndexShown]) renderSheetHistory();
  });
}
