import { FILL_CODE, MAX_ITEMS_PER_SHEET } from '../../config/constants.js';
import { appData, createEmptySheet } from '../../state/app-data.js';
import { commitChanges } from '../../state/change-notifier.js';
import {
  allocateReturns,
  calculateHeldQuantity,
  getAllItemsOldestFirst,
  getPendingSignerRole,
} from '../../domain/ppe-items.js';
import { byId, clearInputs, closeDialog, escapeHtml, showDialog } from '../../utils/dom.js';
import { formatDeliveryTimestampText } from '../../utils/date.js';
import { capitalizeName, normalizeComparisonKey } from '../../utils/text.js';
import { SignaturePad } from '../../ui/signature-pad.js';
import { showToast } from '../../ui/toast.js';
import { createCaLookup } from './ca-lookup.js';
import { getPhotoDataUrl, refreshPhotoControls, resetPhoto } from './photo-capture.js';
import { openSignatureDialog } from './signature-dialog.js';

/**
 * A PPE line waiting in the dialog's list, not yet saved on the sheet.
 * `quantityToReturn` is registered on the employee's earlier line of the same PPE.
 * @typedef {{name: string, caNumber: string, quantityReceived: number, quantityToReturn: number, fillCode: string}} PendingItem
 */

let employeeIndex = null;
/** @type {PendingItem[]} */
let pendingItems = [];
let isPpeNameSuggested = false;
let isAddingItem = false;
let isSavingDelivery = false;
/** Remembers the held quantity the swap notice was built for. */
let swapState = { key: '', heldQuantity: 0 };
let fullSheetEmployeeIndex = 0;
let receiptSignaturePad = null;

const readQuantity = () => Math.max(1, parseInt(byId('quantity-input').value, 10) || 1);
const currentEmployee = () => appData.employees[employeeIndex];

/* ---------- Opening ---------- */

export function openDeliveryDialog(index) {
  employeeIndex = index;
  const employee = currentEmployee();

  if (employee.currentSheet.items.length >= MAX_ITEMS_PER_SHEET) {
    fullSheetEmployeeIndex = index;
    byId('sheet-full-text').textContent = `A ficha de EPI de ${employee.name} está completa (${MAX_ITEMS_PER_SHEET}/${MAX_ITEMS_PER_SHEET} linhas preenchidas). Crie uma nova ficha: a atual será guardada no histórico do funcionário.`;
    showDialog('sheet-full-dialog');
    return;
  }

  const missingSignerRole = getPendingSignerRole(employee.currentSheet);
  if (missingSignerRole) {
    openSignatureDialog({
      employeeIndex: index,
      role: missingSignerRole,
      afterEmployeeSigned: () => openDeliveryDialog(index),
    });
    return;
  }

  byId('delivery-dialog-title').textContent = `Cadastrar EPI · ${employee.name}`;
  clearInputs(['ppe-name-input', 'ca-number-input']);
  resetItemFields();
  swapState = { key: '', heldQuantity: 0 };
  byId('swap-notice').hidden = true;
  pendingItems = [];
  byId('add-item-error').textContent = '';
  renderPendingItems();
  getReceiptPad().clear();
  showDialog('delivery-dialog');
  getReceiptPad().clear();
}

/** Archives the full sheet in the employee's history and starts a blank one. */
export function startNewSheet() {
  const employee = appData.employees[fullSheetEmployeeIndex];
  employee.archivedSheets.push({ ...employee.currentSheet, archivedOn: new Date().toLocaleDateString('pt-BR') });
  employee.currentSheet = createEmptySheet();
  commitChanges();
  closeDialog('sheet-full-dialog');
  openDeliveryDialog(fullSheetEmployeeIndex);
}

function getReceiptPad() {
  if (!receiptSignaturePad) {
    receiptSignaturePad = new SignaturePad(byId('receipt-signature-canvas'), {
      onDrawStart: () => { byId('receipt-signature-error').textContent = ''; },
    });
  }
  return receiptSignaturePad;
}

export function clearReceiptSignature() {
  getReceiptPad().clear();
  byId('receipt-signature-error').textContent = '';
}

/* ---------- Fields ---------- */

function resetItemFields() {
  byId('ppe-name-input').value = '';
  byId('ca-number-input').value = '';
  caLookup.clearMessage();
  isPpeNameSuggested = false;
  byId('quantity-input').value = 1;
  byId('returned-quantity-input').value = 0;
  byId('fill-code-select').value = FILL_CODE.firstDelivery;
}

const caLookup = createCaLookup({
  setSuggestedName(name) {
    byId('ppe-name-input').value = name;
    isPpeNameSuggested = true;
    refreshSwapNotice();
  },
  clearSuggestedName() {
    if (!isPpeNameSuggested) return;
    byId('ppe-name-input').value = '';
    isPpeNameSuggested = false;
    refreshSwapNotice();
  },
});

/** Items counted when computing how many units the employee still holds. */
function itemsForHeldQuantity() {
  const pendingAsItems = pendingItems.map((item) => ({
    name: item.name,
    quantityReceived: item.quantityReceived,
    quantityReturned: item.quantityToReturn,
  }));
  return [...getAllItemsOldestFirst(currentEmployee()), ...pendingAsItems];
}

/**
 * When the employee still holds the PPE being delivered, this is a
 * replacement: suggest code 02 and returning the old units.
 */
function refreshSwapNotice() {
  const notice = byId('swap-notice');
  const name = capitalizeName(byId('ppe-name-input').value.trim());
  if (!name || !currentEmployee()) {
    if (swapState.key) {
      byId('fill-code-select').value = FILL_CODE.firstDelivery;
      byId('returned-quantity-input').value = 0;
    }
    swapState = { key: '', heldQuantity: 0 };
    notice.hidden = true;
    return;
  }

  const { heldQuantity, lastDeliveredItem } = calculateHeldQuantity(itemsForHeldQuantity(), name);
  const key = heldQuantity > 0 ? `${normalizeComparisonKey(name)}|${heldQuantity}` : '';
  if (key === swapState.key) return;
  swapState = { key, heldQuantity };

  if (heldQuantity > 0) {
    const lastDeliveryDay = lastDeliveredItem ? lastDeliveredItem.deliveredAtText.split(/[\s,]+/)[0] : '';
    const quantityToReturn = Math.min(heldQuantity, readQuantity());
    byId('fill-code-select').value = FILL_CODE.normalWearReplacement;
    byId('returned-quantity-input').value = quantityToReturn;
    notice.innerHTML = `<b>Troca detectada.</b> Este funcionário ainda tem ${heldQuantity} un. de “${escapeHtml(name)}”${lastDeliveryDay ? ` (última entrega em ${escapeHtml(lastDeliveryDay)})` : ''}. Preenchi o código <b>02</b> e a devolução de <b>${quantityToReturn}</b> un., que será registrada na <b>linha do EPI anterior</b> (não nesta). Se foi extravio, escolha o código 03 (a devolução zera); se foi desgaste anormal, 04.`;
    notice.hidden = false;
  } else {
    byId('fill-code-select').value = FILL_CODE.firstDelivery;
    byId('returned-quantity-input').value = 0;
    notice.hidden = true;
  }
}

function handleQuantityChange() {
  if (!swapState.key) return;
  if (byId('fill-code-select').value !== FILL_CODE.lossReplacement) {
    byId('returned-quantity-input').value = Math.min(swapState.heldQuantity, readQuantity());
  }
}

function handleFillCodeChange() {
  if (!swapState.key) return;
  const isLoss = byId('fill-code-select').value === FILL_CODE.lossReplacement;
  byId('returned-quantity-input').value = isLoss ? 0 : Math.min(swapState.heldQuantity, readQuantity());
}

/* ---------- Pending list ---------- */

function renderPendingItems() {
  const freeLines = MAX_ITEMS_PER_SHEET - currentEmployee().currentSheet.items.length - pendingItems.length;
  const rows = pendingItems.length
    ? pendingItems.map((item, index) => `
        <div class="pending-item">
          <div>
            <b>${escapeHtml(item.name)}</b>
            <span>CA ${escapeHtml(item.caNumber || '—')} · Qtd. ${escapeHtml(item.quantityReceived)} · Cód. ${escapeHtml(item.fillCode || FILL_CODE.firstDelivery)}${item.quantityToReturn > 0 ? ` · devolve ${escapeHtml(item.quantityToReturn)} do anterior` : ''}</span>
          </div>
          <button type="button" aria-label="Remover" data-action="remove-delivery-item" data-item-index="${index}">×</button>
        </div>`).join('')
    : '<p class="pending-items__empty">Nenhum EPI adicionado ainda.</p>';
  byId('pending-items').innerHTML = `
    <div class="pending-items__header">EPIs desta entrega (${pendingItems.length})<span>Linhas livres na ficha: ${freeLines}</span></div>${rows}`;
}

export function removePendingItem(itemIndex) {
  pendingItems.splice(itemIndex, 1);
  byId('add-item-error').textContent = '';
  renderPendingItems();
}

/** Validates the fields and adds a line to the pending list. Resolves true when added. */
export async function addPendingItem() {
  if (isAddingItem) return false;
  isAddingItem = true;
  try {
    const errorElement = byId('add-item-error');
    errorElement.textContent = '';

    const caDigits = byId('ca-number-input').value.replace(/\D/g, '');
    if (!byId('ppe-name-input').value.trim() && caDigits) {
      await caLookup.lookUpOnWeb(caDigits, { ignoreTypingChanges: true });
    }

    const name = capitalizeName(byId('ppe-name-input').value.trim());
    if (!name) {
      errorElement.textContent = 'Informe o nome do EPI (ou um CA que o site reconheça).';
      byId('ppe-name-input').focus();
      return false;
    }
    if (currentEmployee().currentSheet.items.length + pendingItems.length >= MAX_ITEMS_PER_SHEET) {
      errorElement.textContent = `A ficha comporta no máximo ${MAX_ITEMS_PER_SHEET} EPIs. Salve esta entrega e crie uma nova ficha para continuar.`;
      return false;
    }

    const quantityToReturn = Math.max(0, parseInt(byId('returned-quantity-input').value, 10) || 0);
    const { heldQuantity } = calculateHeldQuantity(itemsForHeldQuantity(), name);
    if (quantityToReturn > heldQuantity) {
      errorElement.textContent = heldQuantity > 0
        ? `Devolvido maior que o saldo em posse do funcionário (${heldQuantity} un.).`
        : 'Não há EPI anterior deste tipo registrado para devolver. Deixe Devolvido em 0.';
      byId('returned-quantity-input').focus();
      return false;
    }

    pendingItems.push({
      name,
      caNumber: byId('ca-number-input').value.trim(),
      quantityReceived: readQuantity(),
      quantityToReturn,
      fillCode: byId('fill-code-select').value,
    });
    resetItemFields();
    refreshSwapNotice();
    renderPendingItems();
    byId('ca-number-input').focus();
    return true;
  } finally {
    isAddingItem = false;
  }
}

/* ---------- Saving ---------- */

function summarizeDeliveredNames(items) {
  const firstNames = items.slice(0, 3).map((item) => item.name).join(', ');
  return firstNames + (items.length > 3 ? ` +${items.length - 3}` : '');
}

function validateDeliveryReadyToSave() {
  if (!pendingItems.length) {
    byId('add-item-error').textContent = 'Adicione ao menos um EPI à lista.';
    return false;
  }
  if (!getPhotoDataUrl()) {
    byId('photo-message').textContent = 'A foto do colaborador é obrigatória: abra a câmera e tire a foto.';
    return false;
  }
  if (!getReceiptPad().hasDrawing) {
    byId('receipt-signature-error').textContent = 'A assinatura de recebimento é obrigatória: ela vale para todos os EPIs da lista.';
    return false;
  }
  return true;
}

export async function saveDelivery() {
  if (isSavingDelivery) return;
  isSavingDelivery = true;
  try {
    const hasUnaddedItem = byId('ppe-name-input').value.trim() || byId('ca-number-input').value.trim();
    if (hasUnaddedItem && !(await addPendingItem())) return;

    const employee = currentEmployee();
    if (getPendingSignerRole(employee.currentSheet)) {
      closeDialog('delivery-dialog');
      openDeliveryDialog(employeeIndex);
      return;
    }
    if (!validateDeliveryReadyToSave()) return;

    const deliveryId = `s${Date.now().toString(36)}`;
    const deliveredAtText = formatDeliveryTimestampText();
    appData.signatures[deliveryId] = getReceiptPad().toDataUrl();
    appData.photos[deliveryId] = getPhotoDataUrl();

    const newItems = [];
    pendingItems.forEach((pending) => {
      if (pending.quantityToReturn > 0) {
        allocateReturns(
          [...getAllItemsOldestFirst(employee), ...newItems],
          normalizeComparisonKey(pending.name),
          pending.quantityToReturn,
          deliveredAtText,
        );
      }
      newItems.push({
        name: pending.name,
        caNumber: pending.caNumber,
        quantityReceived: pending.quantityReceived,
        quantityReturned: 0,
        fillCode: pending.fillCode,
        deliveredAtText,
        deliveredAt: Date.now(),
        returnedAtText: '',
        signatureId: deliveryId,
        photoId: deliveryId,
      });
    });
    employee.currentSheet.items.push(...newItems);

    const savedItems = pendingItems;
    pendingItems = [];
    commitChanges();
    resetPhoto();
    closeDialog('delivery-dialog');
    showToast(
      savedItems.length === 1
        ? 'EPI cadastrado e entregue com sucesso'
        : `${savedItems.length} EPIs cadastrados e entregues com sucesso`,
      `${summarizeDeliveredNames(savedItems)} · ${employee.name}`,
    );
  } finally {
    isSavingDelivery = false;
  }
}

/* ---------- Wiring ---------- */

export function bindDeliveryDialogEvents() {
  const dialog = byId('delivery-dialog');
  byId('ca-number-input').addEventListener('input', caLookup.handleCaNumberInput);
  byId('ppe-name-input').addEventListener('input', () => {
    refreshSwapNotice();
    isPpeNameSuggested = false;
  });
  byId('quantity-input').addEventListener('input', handleQuantityChange);
  byId('fill-code-select').addEventListener('change', handleFillCodeChange);

  ['ca-number-input', 'ppe-name-input', 'quantity-input'].forEach((inputId) => {
    byId(inputId).addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      addPendingItem();
    });
  });

  dialog.addEventListener('close', refreshPhotoControls);
  dialog.addEventListener('toggle', () => {
    if (!dialog.open) return;
    getReceiptPad().clear();
    resetPhoto();
  });
}

/** Re-checks the CA field, e.g. after a new CAEPI database was imported. */
export function refreshCaLookup() {
  if (byId('ca-number-input').value) caLookup.handleCaNumberInput();
}
