import { BACKUP_APP_NAME, SCHEMA_VERSION } from '../config/constants.js';
import { allocateReturns } from '../domain/ppe-items.js';
import { createEmptyAppData, createEmptySheet } from '../state/app-data.js';
import { parseDayMonthYearText } from '../utils/date.js';
import { capitalizeName, normalizeComparisonKey } from '../utils/text.js';

/**
 * Conversion of data saved by earlier versions of the system (schema 1, with
 * abbreviated Portuguese field names) into the current schema, plus the
 * validation of backup files.
 */

/* ---------- Accounts ---------- */

/** Converts a stored account record to the current shape (returns the same object when already current). */
export function migrateAccountRecord(record) {
  if (!record || record.username !== undefined) return record;
  return {
    fullName: record.nome,
    username: record.user,
    passwordSalt: record.salt,
    passwordHash: record.hash,
    createdAt: record.criado || 0,
    guideAcknowledgedAt: record.ack || 0,
  };
}

/* ---------- Account data ---------- */

let generatedSignatureCounter = 0;

function convertLegacyItem(legacyItem, signatures) {
  let signatureId = legacyItem.sid || '';
  if (!signatureId && legacyItem.sig) {
    generatedSignatureCounter += 1;
    signatureId = `m${Date.now().toString(36)}${generatedSignatureCounter}`;
    signatures[signatureId] = legacyItem.sig;
  }
  const deliveredAtDate = legacyItem.ts ? new Date(legacyItem.ts) : parseDayMonthYearText(legacyItem.data);
  return {
    name: capitalizeName(legacyItem.nome || ''),
    caNumber: legacyItem.ca === undefined ? '' : String(legacyItem.ca),
    quantityReceived: Number(legacyItem.qtd) || 1,
    quantityReturned: Number(legacyItem.dev) || 0,
    fillCode: legacyItem.cod || '',
    deliveredAtText: legacyItem.data || '',
    deliveredAt: deliveredAtDate ? deliveredAtDate.getTime() : null,
    returnedAtText: legacyItem.devData || '',
    signatureId,
    photoId: legacyItem.fid || '',
    needsReturnRelocation: !legacyItem.mv && legacyItem.dev > 0,
  };
}

function convertLegacySheet(legacyItems, employeeSignature, technicianSignature, signatures) {
  return {
    items: (legacyItems || []).map((item) => convertLegacyItem(item, signatures)),
    employeeSignature: employeeSignature || '',
    technicianSignature: technicianSignature
      ? { name: technicianSignature.nome, signatureId: technicianSignature.sid, signedAt: technicianSignature.at }
      : null,
  };
}

/**
 * Very old versions stored the returned quantity on the delivery line that
 * replaced the old PPE. It now belongs to the line of the PPE that was returned.
 */
function relocateLegacyReturns(employee) {
  const allItems = [...employee.archivedSheets.flatMap((sheet) => sheet.items), ...employee.currentSheet.items];
  allItems.forEach((item, index) => {
    if (!item.needsReturnRelocation) return;
    const returnedQuantity = item.quantityReturned;
    item.quantityReturned = 0;
    allocateReturns(allItems.slice(0, index), normalizeComparisonKey(item.name), returnedQuantity, item.deliveredAtText);
  });
  allItems.forEach((item) => delete item.needsReturnRelocation);
}

function convertLegacyEmployee(legacyEmployee, signatures) {
  const employee = {
    name: capitalizeName(legacyEmployee.nome),
    role: capitalizeName(legacyEmployee.funcao || ''),
    workSite: capitalizeName(legacyEmployee.obra || ''),
    registrationNumber: legacyEmployee.mat || '',
    currentSheet: convertLegacySheet(legacyEmployee.epis, legacyEmployee.sig, legacyEmployee.tec, signatures),
    archivedSheets: (legacyEmployee.hist || []).map((legacySheet) => ({
      ...convertLegacySheet(legacySheet.epis, legacySheet.sig, legacySheet.tec, signatures),
      archivedOn: legacySheet.data || '',
    })),
  };
  relocateLegacyReturns(employee);
  return employee;
}

function convertLegacyCaCache(legacyCache = {}) {
  return Object.fromEntries(
    Object.entries(legacyCache).map(([caNumber, [name, validUntil, situation]]) => [
      caNumber,
      { name, validUntil: validUntil || '', situation: situation || '' },
    ]),
  );
}

function convertLegacyData(legacy) {
  const signatures = { ...(legacy.sigs || {}) };
  const data = createEmptyAppData();
  data.employees = legacy.emp
    .filter((employee) => employee && typeof employee.nome === 'string')
    .map((employee) => convertLegacyEmployee(employee, signatures));
  data.signatures = signatures;
  data.photos = legacy.photos || {};
  data.caLookupCache = convertLegacyCaCache(legacy.caCache);
  data.lastBackupAt = legacy.lastBackup || 0;
  return data;
}

function normalizeCurrentSheet(sheet) {
  return {
    ...createEmptySheet(),
    ...sheet,
    items: Array.isArray(sheet && sheet.items) ? sheet.items : [],
  };
}

function normalizeCurrentData(data) {
  return {
    ...createEmptyAppData(),
    ...data,
    employees: data.employees
      .filter((employee) => employee && typeof employee.name === 'string')
      .map((employee) => ({
        ...employee,
        currentSheet: normalizeCurrentSheet(employee.currentSheet),
        archivedSheets: (employee.archivedSheets || []).map(normalizeCurrentSheet),
      })),
  };
}

/**
 * Accepts stored data of any schema version and returns data in the current
 * schema, or null when the content is not valid account data.
 */
export function migrateAccountData(rawData) {
  if (!rawData || typeof rawData !== 'object') return null;
  if (rawData.schemaVersion === SCHEMA_VERSION && Array.isArray(rawData.employees)) {
    return normalizeCurrentData(rawData);
  }
  if (Array.isArray(rawData.emp)) return convertLegacyData(rawData);
  return null;
}

/* ---------- Backup files ---------- */

/**
 * Reads a backup file (current format or the Portuguese-keyed format of earlier
 * versions). Returns `{ data, generatedAt }` or throws when the file is invalid.
 */
export function parseBackupFile(parsedJson) {
  if (!parsedJson || parsedJson.app !== BACKUP_APP_NAME) throw new Error('invalid-backup');
  const rawData = parsedJson.data !== undefined ? parsedJson.data : parsedJson.dados;
  const data = migrateAccountData(rawData);
  if (!data) throw new Error('invalid-backup');
  return { data, generatedAt: parsedJson.generatedAt || parsedJson.gerado || '' };
}
