import { SIGNER_ROLE } from '../config/constants.js';
import { normalizeComparisonKey } from '../utils/text.js';

/** Every delivered line of an employee: archived sheets first, then the current sheet. */
export function getAllItemsOldestFirst(employee) {
  return [
    ...employee.archivedSheets.flatMap((sheet) => sheet.items),
    ...employee.currentSheet.items,
  ];
}

export function countDeliveredItems(employee) {
  return getAllItemsOldestFirst(employee).length;
}

/** Which signature a sheet is still missing: the technician signs first, then the employee. */
export function getPendingSignerRole(sheet) {
  if (!sheet.technicianSignature) return SIGNER_ROLE.technician;
  if (!sheet.employeeSignature) return SIGNER_ROLE.employee;
  return null;
}

/**
 * How many units of a PPE the employee still holds (received minus returned)
 * and the most recent delivered line of that PPE.
 */
export function calculateHeldQuantity(items, ppeName) {
  const key = normalizeComparisonKey(ppeName);
  let received = 0;
  let returned = 0;
  let lastDeliveredItem = null;
  items.forEach((item) => {
    if (normalizeComparisonKey(item.name) !== key) return;
    received += Number(item.quantityReceived) || 0;
    returned += Number(item.quantityReturned) || 0;
    if (item.deliveredAtText) lastDeliveredItem = item;
  });
  return { heldQuantity: Math.max(0, received - returned), lastDeliveredItem };
}

/**
 * Registers `quantity` returned units on the earliest still-open lines of the
 * given PPE (matched by `normalizedName`). Returns the units that found no line.
 */
export function allocateReturns(items, normalizedName, quantity, returnedAtText) {
  let remaining = quantity;
  for (const item of items) {
    if (remaining <= 0) break;
    if (normalizeComparisonKey(item.name) !== normalizedName) continue;
    const openQuantity = (Number(item.quantityReceived) || 0) - (Number(item.quantityReturned) || 0);
    if (openQuantity <= 0) continue;
    const allocated = Math.min(openQuantity, remaining);
    item.quantityReturned = (Number(item.quantityReturned) || 0) + allocated;
    item.returnedAtText = returnedAtText;
    remaining -= allocated;
  }
  return remaining;
}

/** Units of a log entry or item, counting a missing quantity as one. */
export const unitsOf = (quantityReceived) => Number(quantityReceived) || 1;
