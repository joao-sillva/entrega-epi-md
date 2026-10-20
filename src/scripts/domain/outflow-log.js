import { toIsoDate, toMonthKey } from '../utils/date.js';
import { getAllItemsOldestFirst } from './ppe-items.js';

/**
 * @typedef {Object} OutflowEntry
 * @property {Date|null} deliveredAt
 * @property {string} employeeName
 * @property {string} registrationNumber
 * @property {string} role
 * @property {string} workSite
 * @property {string} employeeKey
 * @property {string} ppeName
 * @property {string} caNumber
 * @property {number} quantityReceived
 * @property {number} quantityReturned
 * @property {string} fillCode
 * @property {string} photoId
 */

const employeeKeyOf = (employee) => `${employee.name}\u0001${employee.registrationNumber || ''}`;

/** Flat list of every PPE delivery of every employee, newest first. */
export function buildOutflowLog(employees) {
  const entries = [];
  employees.forEach((employee) => {
    getAllItemsOldestFirst(employee).forEach((item) => {
      entries.push({
        deliveredAt: item.deliveredAt ? new Date(item.deliveredAt) : null,
        employeeName: employee.name,
        registrationNumber: employee.registrationNumber || '',
        role: employee.role || '',
        workSite: employee.workSite || '',
        employeeKey: employeeKeyOf(employee),
        ppeName: item.name,
        caNumber: item.caNumber,
        quantityReceived: item.quantityReceived,
        quantityReturned: item.quantityReturned,
        fillCode: item.fillCode,
        photoId: item.photoId || '',
      });
    });
  });
  const timeOf = (entry) => (entry.deliveredAt ? entry.deliveredAt.getTime() : -1);
  return entries.sort((a, b) => timeOf(b) - timeOf(a));
}

/**
 * @param {OutflowEntry[]} entries
 * @param {{employeeKey:string, ppeName:string, month:string, fromDate:string, toDate:string}} filters
 */
export function filterOutflowLog(entries, filters) {
  const { employeeKey, ppeName, month, fromDate, toDate } = filters;
  const hasDateFilter = Boolean(month || fromDate || toDate);
  return entries.filter((entry) => {
    if (employeeKey && entry.employeeKey !== employeeKey) return false;
    if (ppeName && entry.ppeName !== ppeName) return false;
    if (!entry.deliveredAt) return !hasDateFilter;
    const day = toIsoDate(entry.deliveredAt);
    return (!month || toMonthKey(entry.deliveredAt) === month)
      && (!fromDate || day >= fromDate)
      && (!toDate || day <= toDate);
  });
}

/** Distinct months ("2026-10") that have at least one dated entry. */
export const listMonthsWithEntries = (entries) => [
  ...new Set(entries.filter((entry) => entry.deliveredAt).map((entry) => toMonthKey(entry.deliveredAt))),
];

/** Employees that appear in the log, as [employeeKey, name] sorted by name. */
export const listEmployeesInLog = (entries) => [
  ...new Map(entries.map((entry) => [entry.employeeKey, entry.employeeName])).entries(),
].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));

export const listPpeNamesInLog = (entries) => [
  ...new Set(entries.map((entry) => entry.ppeName).filter(Boolean)),
].sort((a, b) => a.localeCompare(b, 'pt-BR'));
