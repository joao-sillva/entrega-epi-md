import { closeDialog } from './utils/dom.js';
import { byId } from './utils/dom.js';
import { parseBrazilianDate } from './utils/brazilian-date.js';
import { appData } from './state/app-data.js';
import { onAppDataChanged, requestRender } from './state/change-notifier.js';
import { setSaveFailureHandler } from './storage/data-repository.js';
import { listenForDelegatedEvents, registerChangeActions, registerClickActions } from './ui/actions.js';
import { enableNameCapitalization } from './ui/auto-capitalize.js';
import { toggleMenu } from './ui/dropdown-menu.js';
import { showView } from './ui/navigation.js';
import { showErrorToast } from './ui/toast.js';
import {
  bindLoginGateForms,
  resetAccountAccess,
  showLoginGate,
  toggleForgotPasswordNotice,
  togglePasswordVisibility,
} from './features/auth/login-gate.js';
import { confirmGuide, showGuide } from './features/auth/onboarding-guide.js';
import { openProfileDialog, saveProfile } from './features/auth/profile-dialog.js';
import { signOut, startApplicationSession } from './features/auth/session.js';
import { renderDashboard, toggleRoleList } from './features/dashboard/dashboard.js';
import {
  clearOutflowFilters,
  setDateRangeFilter,
  setEmployeeFilter,
  setMonthFilter,
  setPpeFilter,
} from './features/dashboard/outflow-filters.js';
import { showDeliveryPhoto } from './features/dashboard/outflow-history.js';
import { downloadOutflowExcel, downloadOutflowPdf } from './features/dashboard/outflow-report.js';
import { refreshCaLookup, addPendingItem, bindDeliveryDialogEvents, clearReceiptSignature, openDeliveryDialog, removePendingItem, saveDelivery, startNewSheet } from './features/delivery/delivery-dialog.js';
import { bindPhotoFileInput, chooseDevicePhoto, openCamera, resetPhoto, takePhoto } from './features/delivery/photo-capture.js';
import {
  clearSignature,
  saveSignature,
  signArchivedSheet,
  signCurrentSheet,
} from './features/delivery/signature-dialog.js';
import { askToDeleteEmployee, confirmDeleteEmployee } from './features/employees/delete-employee-dialog.js';
import { openEditEmployeeDialog, openNewEmployeeDialog, saveEmployee } from './features/employees/employee-dialog.js';
import { bindEmployeeListEvents, goToPage, renderEmployeeList } from './features/employees/employee-list.js';
import { bindSheetDialogEvents, exportSheetPdf, openSheet, printSheet } from './features/sheet/sheet-dialog.js';
import { bindSheetHistoryEvents, openSheetHistory } from './features/sheet/sheet-history-dialog.js';
import {
  bindBackupFileInput,
  cancelBackupRestore,
  chooseBackupFile,
  confirmBackupRestore,
  downloadBackup,
} from './features/settings/backup.js';
import {
  loadCaepiDatabase,
  onCaepiDatabaseChanged,
} from './features/settings/caepi-database.js';
import {
  bindCaepiFileInput,
  chooseCaepiFile,
  openSettingsDialog,
  refreshCaepiInfo,
  restoreDefaultCaepi,
} from './features/settings/settings-dialog.js';

const NAME_INPUT_IDS = [
  'employee-name-input',
  'employee-role-input',
  'employee-work-site-input',
  'ppe-name-input',
  'create-full-name-input',
  'profile-full-name-input',
];

function renderAll() {
  renderEmployeeList();
  renderDashboard();
}

const toIndex = (value) => Number(value);
const toOptionalIndex = (value) => (value === undefined ? undefined : Number(value));

/** Applies the typed dd/mm/aaaa range; a field with an invalid date is marked and nothing changes. */
function applyDateRangeFilter() {
  const fields = ['filter-from-date', 'filter-to-date'].map(byId);
  const isoDates = fields.map((field) => (field.value.trim() ? parseBrazilianDate(field.value) : ''));
  fields.forEach((field, position) => field.classList.toggle('is-invalid', isoDates[position] === null));
  if (isoDates.includes(null)) return;
  setDateRangeFilter(isoDates[0], isoDates[1]);
  requestRender();
}

function registerActions() {
  registerClickActions({
    // Navigation and generic
    'show-view': ({ view }) => showView(view),
    'close-dialog': ({ dialogId }) => closeDialog(dialogId),
    'toggle-menu': ({ menuId }) => toggleMenu(menuId),

    // Account
    'show-login-panel': () => showLoginGate('login'),
    'show-create-account-panel': () => showLoginGate('create'),
    'toggle-forgot-password': toggleForgotPasswordNotice,
    'reset-account-access': resetAccountAccess,
    'toggle-password-visibility': ({ inputId }) => togglePasswordVisibility(inputId),
    'open-profile-dialog': openProfileDialog,
    'save-profile': saveProfile,
    'sign-out': () => { closeDialog('profile-dialog'); signOut(); },
    'confirm-guide': confirmGuide,

    // Employees
    'open-employee-dialog': openNewEmployeeDialog,
    'edit-employee': ({ employeeIndex }) => openEditEmployeeDialog(toIndex(employeeIndex)),
    'save-employee': saveEmployee,
    'ask-delete-employee': ({ employeeIndex }) => askToDeleteEmployee(toIndex(employeeIndex)),
    'confirm-delete-employee': confirmDeleteEmployee,
    'go-to-page': ({ page }) => goToPage(toIndex(page)),

    // Delivery
    'open-delivery-dialog': ({ employeeIndex }) => openDeliveryDialog(toIndex(employeeIndex)),
    'add-delivery-item': addPendingItem,
    'remove-delivery-item': ({ itemIndex }) => removePendingItem(toIndex(itemIndex)),
    'save-delivery': saveDelivery,
    'clear-receipt-signature': clearReceiptSignature,
    'start-new-sheet': startNewSheet,
    'open-camera': openCamera,
    'take-photo': takePhoto,
    'retake-photo': () => resetPhoto({ reopenCamera: true }),
    'choose-photo-file': chooseDevicePhoto,

    // Signatures
    'sign-pending': ({ employeeIndex }) => signCurrentSheet(toIndex(employeeIndex)),
    'sign-archived-sheet': ({ employeeIndex, sheetIndex }) => signArchivedSheet(toIndex(employeeIndex), toIndex(sheetIndex)),
    'clear-signature': clearSignature,
    'save-signature': saveSignature,

    // Sheet
    'open-sheet': ({ employeeIndex, sheetIndex }) => openSheet(toIndex(employeeIndex), toOptionalIndex(sheetIndex)),
    'open-sheet-history': ({ employeeIndex }) => openSheetHistory(toIndex(employeeIndex)),
    'export-sheet-pdf': exportSheetPdf,
    'print-sheet': printSheet,

    // Dashboard
    'toggle-role-list': toggleRoleList,
    'view-delivery-photo': ({ entryPosition }) => showDeliveryPhoto(toIndex(entryPosition)),
    'download-outflow-excel': downloadOutflowExcel,
    'download-outflow-pdf': downloadOutflowPdf,
    'clear-outflow-filters': () => { clearOutflowFilters(); requestRender(); },

    // Settings
    'open-settings-dialog': openSettingsDialog,
    'choose-caepi-file': chooseCaepiFile,
    'restore-default-caepi': restoreDefaultCaepi,
    'download-backup': downloadBackup,
    'choose-backup-file': chooseBackupFile,
    'confirm-backup-restore': confirmBackupRestore,
    'cancel-backup-restore': cancelBackupRestore,
    'open-guide-from-settings': () => { closeDialog('settings-dialog'); showGuide({ openedFromSettings: true }); },
  });

  const applyFilterAndRender = (applyFilter) => (value) => { applyFilter(value); requestRender(); };
  registerChangeActions({
    'filter-employee': applyFilterAndRender(setEmployeeFilter),
    'filter-ppe': applyFilterAndRender(setPpeFilter),
    'filter-month': applyFilterAndRender(setMonthFilter),
    'filter-date-range': applyDateRangeFilter,
  });
}

function bindStaticEvents() {
  bindLoginGateForms();
  bindEmployeeListEvents();
  enableNameCapitalization(NAME_INPUT_IDS);
  bindDeliveryDialogEvents();
  bindPhotoFileInput();
  bindBackupFileInput();
  bindCaepiFileInput();
  bindSheetDialogEvents();
  bindSheetHistoryEvents();
}

function start() {
  registerActions();
  listenForDelegatedEvents();
  bindStaticEvents();

  setSaveFailureHandler(() => showErrorToast(
    'Não foi possível salvar os dados',
    'O armazenamento do navegador está cheio ou bloqueado. Baixe um backup em Configuração agora.',
  ));
  onAppDataChanged(renderAll);
  onCaepiDatabaseChanged(() => {
    refreshCaepiInfo();
    refreshCaLookup();
  });

  loadCaepiDatabase();
  renderAll();
  startApplicationSession();
}

start();
