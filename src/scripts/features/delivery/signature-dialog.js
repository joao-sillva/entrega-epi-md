import { SIGNER_ROLE } from '../../config/constants.js';
import { appData, getSheet } from '../../state/app-data.js';
import { commitChanges } from '../../state/change-notifier.js';
import { getPendingSignerRole } from '../../domain/ppe-items.js';
import { getCurrentAccount } from '../../storage/accounts.js';
import { byId, closeDialog, showDialog } from '../../utils/dom.js';
import { capitalizeName } from '../../utils/text.js';
import { SignaturePad } from '../../ui/signature-pad.js';

let signaturePad = null;

/**
 * What the open dialog is collecting.
 * @type {{employeeIndex: number, role: string, archivedIndex: number|null, afterEmployeeSigned: Function|null}}
 */
let signingRequest = null;

const pad = () => signaturePad || (signaturePad = new SignaturePad(byId('signature-canvas')));

/**
 * Opens the dialog to collect one signature.
 *
 * @param {Object} request
 * @param {number} request.employeeIndex
 * @param {string} request.role                 SIGNER_ROLE.technician or SIGNER_ROLE.employee.
 * @param {number} [request.archivedIndex]      Sign an archived sheet instead of the current one.
 * @param {Function} [request.afterEmployeeSigned]  Called once the employee signed the current sheet.
 */
export function openSignatureDialog({ employeeIndex, role, archivedIndex = null, afterEmployeeSigned = null }) {
  signingRequest = { employeeIndex, role, archivedIndex, afterEmployeeSigned };
  const employee = appData.employees[employeeIndex];
  const isTechnician = role === SIGNER_ROLE.technician;
  const sheetSuffix = archivedIndex !== null ? ` · Ficha ${archivedIndex + 1}` : '';

  byId('signature-dialog-title').textContent = (isTechnician
    ? 'Assinatura do técnico de segurança'
    : `Assinatura do funcionário · ${employee.name}`) + sheetSuffix;
  byId('signature-dialog-text').textContent = isTechnician
    ? 'O técnico de segurança assina primeiro, para liberar a ficha. Depois o funcionário assina.'
    : 'A assinatura é obrigatória antes de qualquer entrega de EPI. Sem assinatura, o funcionário não recebe o EPI.';
  showDialog('signature-dialog');
  clearSignature();
}

export function clearSignature() {
  pad().clear();
  byId('signature-error').textContent = '';
}

/** Opens the dialog for whichever signature an archived sheet still lacks. */
export function signArchivedSheet(employeeIndex, archivedIndex) {
  const sheet = appData.employees[employeeIndex].archivedSheets[archivedIndex];
  openSignatureDialog({
    employeeIndex,
    role: getPendingSignerRole(sheet) || SIGNER_ROLE.employee,
    archivedIndex,
  });
}

/** Opens the dialog for the signature the current sheet needs next. */
export function signCurrentSheet(employeeIndex) {
  const sheet = appData.employees[employeeIndex].currentSheet;
  openSignatureDialog({ employeeIndex, role: getPendingSignerRole(sheet) || SIGNER_ROLE.employee });
}

function createTechnicianSignature(dataUrl) {
  const signatureId = `t${Date.now().toString(36)}`;
  appData.signatures[signatureId] = dataUrl;
  const account = getCurrentAccount();
  return {
    name: capitalizeName(account ? account.fullName : ''),
    signatureId,
    signedAt: Date.now(),
  };
}

export function saveSignature() {
  const { employeeIndex, role, archivedIndex, afterEmployeeSigned } = signingRequest;
  const isTechnician = role === SIGNER_ROLE.technician;
  if (!pad().hasDrawing) {
    byId('signature-error').textContent = isTechnician
      ? 'A assinatura do técnico de segurança é obrigatória.'
      : 'A assinatura é obrigatória. Sem assinatura o funcionário não recebe o EPI.';
    return;
  }

  const dataUrl = pad().toDataUrl();
  const sheet = getSheet(appData.employees[employeeIndex], archivedIndex === null ? undefined : archivedIndex);

  if (isTechnician) sheet.technicianSignature = createTechnicianSignature(dataUrl);
  else sheet.employeeSignature = dataUrl;
  commitChanges();
  closeDialog('signature-dialog');

  const isCurrentSheet = archivedIndex === null;
  if (isCurrentSheet && isTechnician) {
    // The employee signs right after the technician.
    setTimeout(() => openSignatureDialog({ employeeIndex, role: SIGNER_ROLE.employee, afterEmployeeSigned }), 60);
  } else if (isCurrentSheet && afterEmployeeSigned) {
    afterEmployeeSigned();
  }
}
