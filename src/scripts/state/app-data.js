import { SCHEMA_VERSION } from '../config/constants.js';

/**
 * @typedef {Object} DeliveredItem            One PPE line printed on a sheet.
 * @property {string} name                    PPE name, e.g. "Luva de Segurança".
 * @property {string} caNumber                Approval certificate (CA) number.
 * @property {number} quantityReceived
 * @property {number} quantityReturned        Units of this line already returned.
 * @property {string} fillCode                "01".."05" (see FILL_CODE).
 * @property {string} deliveredAtText         Date text printed on the sheet.
 * @property {number|null} deliveredAt        Delivery timestamp (ms since epoch).
 * @property {string} returnedAtText          Date text of the last return.
 * @property {string} signatureId             Key of the receipt signature in `signatures`.
 * @property {string} photoId                 Key of the delivery photo in `photos`.
 *
 * @typedef {Object} TechnicianSignature
 * @property {string} name                    Safety technician name (from the account).
 * @property {string} signatureId             Key in `signatures`.
 * @property {number} signedAt                Timestamp (ms).
 *
 * @typedef {Object} Sheet                    One FORM. 87/3 sheet.
 * @property {DeliveredItem[]} items
 * @property {string} employeeSignature       Data URL of the employee signature.
 * @property {TechnicianSignature|null} technicianSignature
 * @property {string} [archivedOn]            Only on archived sheets.
 *
 * @typedef {Object} Employee
 * @property {string} name
 * @property {string} role
 * @property {string} workSite
 * @property {string} registrationNumber
 * @property {Sheet} currentSheet
 * @property {Sheet[]} archivedSheets
 */

export function createEmptySheet() {
  return { items: [], employeeSignature: '', technicianSignature: null };
}

/** @returns {Employee} */
export function createEmployee({ name, role, workSite, registrationNumber }) {
  return {
    name,
    role,
    workSite,
    registrationNumber,
    currentSheet: createEmptySheet(),
    archivedSheets: [],
  };
}

export function createEmptyAppData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    employees: [],
    signatures: {},
    photos: {},
    caLookupCache: {},
    lastBackupAt: 0,
  };
}

/** The data of the signed-in account. Mutated in place; never reassigned. */
export const appData = createEmptyAppData();

export function replaceAppData(nextData) {
  Object.keys(appData).forEach((key) => delete appData[key]);
  Object.assign(appData, nextData);
}

export function resetAppData() {
  replaceAppData(createEmptyAppData());
}

/** Returns the sheet being edited (`archivedIndex` undefined) or one archived sheet. */
export function getSheet(employee, archivedIndex) {
  return archivedIndex === undefined ? employee.currentSheet : employee.archivedSheets[archivedIndex];
}
