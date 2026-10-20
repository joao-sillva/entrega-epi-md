import { appData } from '../../state/app-data.js';
import { commitChanges } from '../../state/change-notifier.js';
import { countDeliveredItems } from '../../domain/ppe-items.js';
import { byId, closeDialog, showDialog } from '../../utils/dom.js';
import { closeAllMenus } from '../../ui/dropdown-menu.js';

let employeeIndexToDelete = null;

/** An employee who already received PPE cannot be deleted: the sheet is the delivery record. */
export function askToDeleteEmployee(employeeIndex) {
  closeAllMenus();
  employeeIndexToDelete = employeeIndex;
  const employee = appData.employees[employeeIndex];
  const deliveredCount = countDeliveredItems(employee);

  if (deliveredCount) {
    byId('delete-dialog-title').textContent = 'Exclusão bloqueada';
    byId('delete-dialog-text').textContent = `${employee.name} já recebeu ${deliveredCount} EPI${deliveredCount > 1 ? 's' : ''}. A ficha é o registro dessas entregas e não pode ser apagada. Para corrigir o cadastro, use "Editar dados".`;
    byId('delete-confirm-button').hidden = true;
  } else {
    byId('delete-dialog-title').textContent = 'Excluir funcionário';
    byId('delete-dialog-text').textContent = `Excluir ${employee.name}? A ficha de EPI dele também será apagada.`;
    byId('delete-confirm-button').hidden = false;
  }
  showDialog('delete-dialog');
}

export function confirmDeleteEmployee() {
  const employee = appData.employees[employeeIndexToDelete];
  if (!employee || countDeliveredItems(employee)) return;
  appData.employees.splice(employeeIndexToDelete, 1);
  commitChanges();
  closeDialog('delete-dialog');
}
