import { EMPLOYEES_PER_PAGE, SIGNER_ROLE_LABEL } from '../../config/constants.js';
import { appData } from '../../state/app-data.js';
import { countDeliveredItems, getPendingSignerRole } from '../../domain/ppe-items.js';
import { byId, escapeHtml } from '../../utils/dom.js';
import { getAvatarColors, getInitials, normalizeComparisonKey, pluralize } from '../../utils/text.js';

const LAYOUT = { cards: 'cards', table: 'table' };

/** Phones show cards; tablets and desktops show the table. */
const PHONE_SCREEN_QUERY = '(max-width: 760px)';

let currentPage = 0;
let searchText = '';

const getActiveLayout = () => (window.matchMedia(PHONE_SCREEN_QUERY).matches ? LAYOUT.cards : LAYOUT.table);

export function resetEmployeeListPosition() {
  currentPage = 0;
  searchText = '';
  byId('employee-search-input').value = '';
}

/** After saving an employee, clears a search that would hide the saved person. */
export function showEmployeeInList(name) {
  if (searchText && !matchesSearch({ name, role: '', workSite: '', registrationNumber: '' })) {
    searchText = '';
    byId('employee-search-input').value = '';
  }
  currentPage = 0;
}

/** Filters the list while the user types (name, role, work site or registration number); switches between table and cards when the screen width changes. */
export function bindEmployeeListEvents() {
  window.matchMedia(PHONE_SCREEN_QUERY).addEventListener('change', renderEmployeeList);
  byId('employee-search-input').addEventListener('input', (event) => {
    searchText = normalizeComparisonKey(event.target.value);
    currentPage = 0;
    renderEmployeeList();
  });
}

function matchesSearch(employee) {
  if (!searchText) return true;
  const searchableText = normalizeComparisonKey(
    `${employee.name} ${employee.role} ${employee.workSite} ${employee.registrationNumber}`,
  );
  return searchText.split(' ').every((word) => searchableText.includes(word));
}

export function goToPage(pageIndex) {
  currentPage = pageIndex;
  renderEmployeeList();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const getMissingSignatureLabel = (employee) => {
  const role = getPendingSignerRole(employee.currentSheet);
  return role ? SIGNER_ROLE_LABEL[role] : '';
};

const hasPendingArchivedSheet = (employee) => employee.archivedSheets.some((sheet) => getPendingSignerRole(sheet));

function renderPager(pageCount) {
  if (pageCount <= 1) {
    byId('pager').innerHTML = '';
    return;
  }
  const pageButtons = Array.from({ length: pageCount }, (_, pageIndex) => `
    <button type="button" class="${pageIndex === currentPage ? 'button--primary' : ''}"
      data-action="go-to-page" data-page="${pageIndex}">${pageIndex + 1}</button>`).join('');
  byId('pager').innerHTML = `
    <button type="button" ${currentPage ? '' : 'disabled'} data-action="go-to-page" data-page="${currentPage - 1}">‹ Anterior</button>
    ${pageButtons}
    <button type="button" ${currentPage < pageCount - 1 ? '' : 'disabled'} data-action="go-to-page" data-page="${currentPage + 1}">Próxima ›</button>`;
}

function renderSummary() {
  const employeeCount = appData.employees.length;
  const itemCount = appData.employees.reduce((sum, employee) => sum + countDeliveredItems(employee), 0);
  const pendingCount = appData.employees.filter(getMissingSignatureLabel).length;
  const parts = [
    `${employeeCount} ${pluralize(employeeCount, 'funcionário', 'funcionários')}`,
    `${itemCount} EPI${pluralize(itemCount, '', 's')} ${pluralize(itemCount, 'entregue', 'entregues')}`,
  ];
  if (pendingCount) {
    parts.push(`${pendingCount} ${pluralize(pendingCount, 'assinatura pendente', 'assinaturas pendentes')}`);
  }
  byId('employees-summary').textContent = parts.join(' · ');
}

function renderEmployeeCard(employee, index) {
  const missingSignature = getMissingSignatureLabel(employee);
  const [avatarBackground, avatarColor] = getAvatarColors(employee.name);
  const archivedWarning = hasPendingArchivedSheet(employee) ? ' ⚠' : '';
  const signatureStatus = missingSignature
    ? `<div class="signature-status signature-status--pending"><i></i>Falta assinatura do ${missingSignature}
         <button type="button" data-action="sign-pending" data-employee-index="${index}">Assinar</button></div>`
    : '<div class="signature-status signature-status--complete"><i></i>Ficha assinada</div>';

  return `
    <article class="card employee-card${missingSignature ? ' is-pending' : ''}">
      ${renderEmployeeMenu(index, archivedWarning)}
      <div class="employee-card__identity">
        <div class="avatar" style="background:${avatarBackground};color:${avatarColor}">${escapeHtml(getInitials(employee.name))}</div>
        <div><b>${escapeHtml(employee.name)}</b><p>${escapeHtml(employee.role)}</p></div>
      </div>
      <div class="employee-card__details">
        <div><span>Obra</span><b>${escapeHtml(employee.workSite)}</b></div>
        <div><span>Matrícula</span><b>${escapeHtml(employee.registrationNumber)}</b></div>
      </div>
      ${signatureStatus}
      <div class="employee-card__actions">
        <button type="button" class="button--primary" data-action="open-delivery-dialog" data-employee-index="${index}">Cadastrar EPI</button>
        <button type="button" data-action="open-sheet" data-employee-index="${index}">Ficha</button>
      </div>
    </article>`;
}

function renderEmployeeMenu(index, archivedWarning) {
  return `
    <button type="button" class="card-menu-button" aria-label="Opções do funcionário"
      data-action="toggle-menu" data-menu-id="employee-menu-${index}">⋯</button>
    <div class="dropdown-menu" id="employee-menu-${index}">
      <button type="button" data-action="edit-employee" data-employee-index="${index}">Editar dados</button>
      <button type="button" data-action="open-sheet-history" data-employee-index="${index}">Histórico de fichas${archivedWarning}</button>
      <button type="button" class="dropdown-menu__danger" data-action="ask-delete-employee" data-employee-index="${index}">Excluir funcionário</button>
    </div>`;
}

function renderEmployeeRow(employee, index) {
  const missingSignature = getMissingSignatureLabel(employee);
  const [avatarBackground, avatarColor] = getAvatarColors(employee.name);
  const archivedWarning = hasPendingArchivedSheet(employee) ? ' ⚠' : '';
  const signatureStatus = missingSignature
    ? `<span class="signature-status signature-status--pending"><i></i>Falta assinatura do ${missingSignature}
         <button type="button" data-action="sign-pending" data-employee-index="${index}">Assinar</button></span>`
    : '<span class="signature-status signature-status--complete"><i></i>Ficha assinada</span>';

  return `
    <tr class="${missingSignature ? 'is-pending' : ''}">
      <td><div class="employee-card__identity">
        <div class="avatar" style="background:${avatarBackground};color:${avatarColor}">${escapeHtml(getInitials(employee.name))}</div>
        <div><b>${escapeHtml(employee.name)}</b><p>${escapeHtml(employee.role)}</p></div>
      </div></td>
      <td>${escapeHtml(employee.workSite)}</td>
      <td>${escapeHtml(employee.registrationNumber)}</td>
      <td>${signatureStatus}</td>
      <td class="employee-table__actions"><div>
        <button type="button" class="button--primary" data-action="open-delivery-dialog" data-employee-index="${index}">Cadastrar EPI</button>
        <button type="button" data-action="open-sheet" data-employee-index="${index}">Ficha</button>
        <span class="employee-table__menu">${renderEmployeeMenu(index, archivedWarning)}</span>
      </div></td>
    </tr>`;
}

function renderEmployeeTable(employeeIndexes) {
  const rows = employeeIndexes.map((index) => renderEmployeeRow(appData.employees[index], index)).join('');
  return `
    <div class="card card--table employee-table-card"><div class="table-scroll">
      <table class="employee-table">
        <thead><tr><th>Funcionário</th><th>Obra</th><th>Matrícula</th><th>Situação</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div></div>`;
}

function renderEmptyResult(hasEmployees) {
  return hasEmployees
    ? '<p class="empty-list-message">Nenhum funcionário encontrado para essa busca.</p>'
    : '';
}

export function renderEmployeeList() {
  const { employees } = appData;
  employees.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

  const visibleIndexes = employees
    .map((_, index) => index)
    .filter((index) => matchesSearch(employees[index]));
  const activeLayout = getActiveLayout();
  const perPage = EMPLOYEES_PER_PAGE;
  const pageCount = Math.max(1, Math.ceil(visibleIndexes.length / perPage));
  if (currentPage >= pageCount) currentPage = pageCount - 1;

  renderPager(pageCount);
  renderSummary();

  const pageIndexes = visibleIndexes.slice(currentPage * perPage, (currentPage + 1) * perPage);
  const grid = byId('employee-grid');
  grid.classList.toggle('employee-grid--table', activeLayout === LAYOUT.table);
  if (!pageIndexes.length) grid.innerHTML = renderEmptyResult(employees.length > 0);
  else if (activeLayout === LAYOUT.table) grid.innerHTML = renderEmployeeTable(pageIndexes);
  else grid.innerHTML = pageIndexes.map((index) => renderEmployeeCard(employees[index], index)).join('');
}
