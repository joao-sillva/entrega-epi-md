import { appData } from '../../state/app-data.js';
import { getAllItemsOldestFirst, getPendingSignerRole, unitsOf } from '../../domain/ppe-items.js';
import { byId, escapeHtml } from '../../utils/dom.js';
import { ICONS } from '../../ui/icons.js';
import { renderOutflowHistory } from './outflow-history.js';

const NO_ROLE_LABEL = 'Sem função';

/** With more roles than this, the role list starts collapsed to avoid long scrolling. */
const ROLES_SHOWN_OPEN_BY_DEFAULT = 5;

/** null = the user has not chosen yet, so the default above applies. */
let roleListChoice = null;

const isRoleListOpen = (roleCount) => (roleListChoice === null ? roleCount <= ROLES_SHOWN_OPEN_BY_DEFAULT : roleListChoice);

export function toggleRoleList() {
  const roleCount = countEmployeesByRole().length;
  roleListChoice = !isRoleListOpen(roleCount);
  renderDashboard();
}

function countEmployeesByRole() {
  const counts = new Map();
  appData.employees.forEach((employee) => {
    const role = employee.role || NO_ROLE_LABEL;
    counts.set(role, (counts.get(role) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
}

const renderStatCard = (icon, value, label) => `
  <div class="stat-card">
    <div class="stat-card__icon">${icon}</div>
    <div><b>${value}</b><span>${label}</span></div>
  </div>`;

function renderRoleBars(roleCounts) {
  if (!roleCounts.length) return '<p class="card__empty-text">Nenhum funcionário cadastrado ainda.</p>';
  const largestCount = roleCounts[0][1];
  return roleCounts.map(([role, count]) => `
    <div class="bar-row">
      <div class="bar-row__header"><span>${escapeHtml(role)}</span><b>${count}</b></div>
      <div class="bar-row__track"><i class="bar-row__fill" style="width:${(count / largestCount) * 100}%"></i></div>
    </div>`).join('');
}

function renderRoleCard(roleCounts) {
  const isOpen = isRoleListOpen(roleCounts.length);
  const countLabel = `${roleCounts.length} ${roleCounts.length === 1 ? 'função' : 'funções'}`;
  return `
    <div class="card role-card${isOpen ? ' is-open' : ''}">
      <button type="button" class="role-card__toggle" aria-expanded="${isOpen}" data-action="toggle-role-list">
        <span class="role-card__chevron">${ICONS.chevron}</span>
        <h3 class="card__title">Funcionários por função</h3>
        <span class="role-card__count">${countLabel}</span>
      </button>
      <div class="role-card__body" ${isOpen ? '' : 'hidden'}>${renderRoleBars(roleCounts)}</div>
    </div>`;
}

export function renderDashboard() {
  const roleCounts = countEmployeesByRole();
  const deliveredUnits = appData.employees
    .flatMap(getAllItemsOldestFirst)
    .reduce((sum, item) => sum + unitsOf(item.quantityReceived), 0);
  const pendingSheets = appData.employees.filter((employee) => getPendingSignerRole(employee.currentSheet)).length;

  byId('dashboard-view').innerHTML = `
    <header class="page-header">
      <p class="eyebrow">Moura Dubeux · Controle de EPI</p>
      <h1>Dashboard</h1>
      <p class="page-subtitle">Acompanhe funcionários, funções, assinaturas pendentes e as saídas de EPI.</p>
    </header>
    <div class="stat-grid">
      ${renderStatCard(ICONS.employees, appData.employees.length, 'Funcionários cadastrados')}
      ${renderStatCard(ICONS.roles, roleCounts.length, 'Funções cadastradas')}
      ${renderStatCard(ICONS.box, deliveredUnits, 'Unidades de EPI entregues')}
      ${renderStatCard(ICONS.pen, pendingSheets, 'Fichas com assinatura pendente')}
    </div>
    ${renderRoleCard(roleCounts)}`;
  renderOutflowHistory();
}
