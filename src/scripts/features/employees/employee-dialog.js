import { appData, createEmployee } from '../../state/app-data.js';
import { commitChanges } from '../../state/change-notifier.js';
import { byId, clearInputs, closeDialog, showDialog } from '../../utils/dom.js';
import { capitalizeName } from '../../utils/text.js';
import { closeAllMenus } from '../../ui/dropdown-menu.js';
import { showEmployeeInList } from './employee-list.js';

const INPUT_IDS = [
  'employee-name-input',
  'employee-role-input',
  'employee-work-site-input',
  'employee-registration-input',
];

/** Index of the employee being edited, or null when registering a new one. */
let editedEmployeeIndex = null;

export function openNewEmployeeDialog() {
  editedEmployeeIndex = null;
  byId('employee-error').textContent = '';
  byId('employee-dialog-title').textContent = 'Cadastrar funcionário';
  clearInputs(INPUT_IDS);
  showDialog('employee-dialog');
}

export function openEditEmployeeDialog(employeeIndex) {
  closeAllMenus();
  const employee = appData.employees[employeeIndex];
  editedEmployeeIndex = employeeIndex;
  byId('employee-error').textContent = '';
  byId('employee-dialog-title').textContent = 'Editar dados';
  byId('employee-name-input').value = employee.name;
  byId('employee-role-input').value = employee.role;
  byId('employee-work-site-input').value = employee.workSite;
  byId('employee-registration-input').value = employee.registrationNumber;
  showDialog('employee-dialog');
}

function registrationIsTaken(registrationNumber) {
  const normalized = registrationNumber.toLowerCase();
  return appData.employees.some((employee, index) => (
    index !== editedEmployeeIndex
    && String(employee.registrationNumber || '').trim().toLowerCase() === normalized
  ));
}

export function saveEmployee() {
  const details = {
    name: capitalizeName(byId('employee-name-input').value.trim()),
    role: capitalizeName(byId('employee-role-input').value.trim()),
    workSite: capitalizeName(byId('employee-work-site-input').value.trim()),
    registrationNumber: byId('employee-registration-input').value.trim(),
  };

  if (!details.name) {
    byId('employee-name-input').focus();
    return;
  }
  if (details.registrationNumber && registrationIsTaken(details.registrationNumber)) {
    byId('employee-error').textContent = 'Já existe um funcionário com esta matrícula.';
    byId('employee-registration-input').focus();
    return;
  }

  if (editedEmployeeIndex === null) appData.employees.push(createEmployee(details));
  else Object.assign(appData.employees[editedEmployeeIndex], details);

  showEmployeeInList(details.name);
  commitChanges();
  closeDialog('employee-dialog');
}
