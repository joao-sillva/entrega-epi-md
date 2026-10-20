import { MONTH_NAMES } from '../../config/constants.js';
import { appData } from '../../state/app-data.js';
import {
  buildOutflowLog,
  filterOutflowLog,
  listEmployeesInLog,
  listMonthsWithEntries,
  listPpeNamesInLog,
} from '../../domain/outflow-log.js';
import { toIsoDate } from '../../utils/date.js';
import { toSlug } from '../../utils/text.js';

/** Filters applied to the PPE outflow history and to the downloadable reports. */
const filters = { employeeKey: '', ppeName: '', month: '', fromDate: '', toDate: '' };

export const getOutflowFilters = () => filters;

export const setEmployeeFilter = (employeeKey) => { filters.employeeKey = employeeKey; };
export const setPpeFilter = (ppeName) => { filters.ppeName = ppeName; };

/** Choosing a month replaces the custom date range. */
export function setMonthFilter(month) {
  filters.month = month;
  filters.fromDate = '';
  filters.toDate = '';
}

/** Choosing a date range replaces the month filter. */
export function setDateRangeFilter(fromDate, toDate) {
  filters.fromDate = fromDate;
  filters.toDate = toDate;
  filters.month = '';
}

export function clearOutflowFilters() {
  Object.assign(filters, { employeeKey: '', ppeName: '', month: '', fromDate: '', toDate: '' });
}

/**
 * Everything the history screen and reports need. Filters that point to an
 * employee or PPE that no longer exists are dropped.
 */
export function getOutflowView() {
  const allEntries = buildOutflowLog(appData.employees);
  const employees = listEmployeesInLog(allEntries);
  const ppeNames = listPpeNamesInLog(allEntries);
  if (filters.employeeKey && !employees.some(([employeeKey]) => employeeKey === filters.employeeKey)) filters.employeeKey = '';
  if (filters.ppeName && !ppeNames.includes(filters.ppeName)) filters.ppeName = '';
  return {
    allEntries,
    entries: filterOutflowLog(allEntries, filters),
    employees,
    ppeNames,
    months: listMonthsWithEntries(allEntries),
  };
}

export const getFilteredOutflowEntries = () => getOutflowView().entries;

const employeeNameOf = (employeeKey) => employeeKey.split('\u0001')[0];

/** Human-readable description of the active filters, printed on the reports. */
export function describeOutflowFilters() {
  const parts = [
    filters.employeeKey
      ? `Colaborador: ${employeeNameOf(filters.employeeKey)}`
      : 'Todos os colaboradores (geral)',
  ];
  if (filters.ppeName) parts.push(`EPI: ${filters.ppeName}`);
  if (filters.month) {
    const [year, monthNumber] = filters.month.split('-').map(Number);
    parts.push(`Mês: ${MONTH_NAMES[monthNumber - 1]} de ${year}`);
  } else if (filters.fromDate || filters.toDate) {
    const formatDay = (isoDay) => (isoDay ? isoDay.split('-').reverse().join('/') : '…');
    parts.push(`Período: ${formatDay(filters.fromDate)} a ${formatDay(filters.toDate)}`);
  } else {
    parts.push('Todo o período');
  }
  return parts.join(' · ');
}

const MAXIMUM_PPE_SLUG_LENGTH = 30;

/** "relatorio-saida-epi-ana-paula-luva-de-seguranca-2026-10-19" (without extension). */
export function buildReportFileName() {
  const employeePart = filters.employeeKey ? toSlug(employeeNameOf(filters.employeeKey)) : 'geral';
  const ppePart = filters.ppeName
    ? `-${toSlug(filters.ppeName).slice(0, MAXIMUM_PPE_SLUG_LENGTH).replace(/-$/, '')}`
    : '';
  return `relatorio-saida-epi-${employeePart}${ppePart}-${toIsoDate(new Date())}`;
}
