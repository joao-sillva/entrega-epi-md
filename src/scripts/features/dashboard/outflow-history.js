import { MONTH_NAMES } from '../../config/constants.js';
import { appData } from '../../state/app-data.js';
import { unitsOf } from '../../domain/ppe-items.js';
import { byId, escapeHtml, showDialog } from '../../utils/dom.js';
import { formatBrazilianDate } from '../../utils/brazilian-date.js';
import { formatDateTime } from '../../utils/date.js';
import { ICONS } from '../../ui/icons.js';
import { getOutflowFilters, getOutflowView } from './outflow-filters.js';

/** Entries shown in the table; the photo buttons refer to them by position. */
let visibleEntries = [];

const renderOptions = (options, selectedValue) => options
  .map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selectedValue ? 'selected' : ''}>${escapeHtml(label)}</option>`)
  .join('');

function renderFilterBar({ employees, ppeNames, months }) {
  const filters = getOutflowFilters();
  const monthOptions = months.map((monthKey) => {
    const [year, monthNumber] = monthKey.split('-').map(Number);
    return [monthKey, `${MONTH_NAMES[monthNumber - 1]} de ${year}`];
  });
  return `
    <div class="filter-bar">
      <div><label for="filter-employee">Colaborador</label>
        <select id="filter-employee" data-change-action="filter-employee">
          <option value="">Todos (geral)</option>${renderOptions(employees, filters.employeeKey)}
        </select></div>
      <div><label for="filter-ppe">EPI</label>
        <select id="filter-ppe" data-wide data-change-action="filter-ppe">
          <option value="">Todos os EPIs</option>${renderOptions(ppeNames.map((name) => [name, name]), filters.ppeName)}
        </select></div>
      <div><label for="filter-month">Mês</label>
        <select id="filter-month" data-change-action="filter-month">
          <option value="">Todos os meses</option>${renderOptions(monthOptions, filters.month)}
        </select></div>
      <div><label for="filter-from-date">De</label>
        <input type="text" id="filter-from-date" inputmode="numeric" maxlength="10" placeholder="dd/mm/aaaa" autocomplete="off"
          value="${formatBrazilianDate(filters.fromDate)}" data-date-mask data-change-action="filter-date-range"></div>
      <div><label for="filter-to-date">Até</label>
        <input type="text" id="filter-to-date" inputmode="numeric" maxlength="10" placeholder="dd/mm/aaaa" autocomplete="off"
          value="${formatBrazilianDate(filters.toDate)}" data-date-mask data-change-action="filter-date-range"></div>
      <div class="filter-bar__more">
        <button type="button" class="more-options-button" aria-label="Mais opções" title="Mais opções"
          data-action="toggle-menu" data-menu-id="outflow-more-menu">⋯</button>
        <div class="dropdown-menu" id="outflow-more-menu">
          <button type="button" data-action="download-outflow-excel">Baixar Excel</button>
          <button type="button" data-action="download-outflow-pdf">Baixar PDF</button>
          <button type="button" data-action="clear-outflow-filters">Limpar filtros</button>
        </div>
      </div>
    </div>`;
}

function renderEntryRow(entry, position) {
  const dateText = entry.deliveredAt
    ? formatDateTime(entry.deliveredAt)
    : '<span class="muted-text">Sem data</span>';
  const hasPhoto = entry.photoId && appData.photos[entry.photoId];
  const photoCell = hasPhoto
    ? `<button type="button" class="view-photo-button" title="Ver foto" aria-label="Ver foto" data-action="view-delivery-photo" data-entry-position="${position}">${ICONS.eye}</button>`
    : '<span class="muted-text">–</span>';
  return `<tr>
    <td>${dateText}</td>
    <td>${escapeHtml(entry.employeeName)}</td>
    <td>${escapeHtml(entry.ppeName)}</td>
    <td>${escapeHtml(entry.caNumber)}</td>
    <td>${escapeHtml(entry.quantityReceived)}</td>
    <td>${entry.quantityReturned > 0 ? escapeHtml(entry.quantityReturned) : ''}</td>
    <td>${escapeHtml(entry.fillCode || '')}</td>
    <td>${photoCell}</td>
  </tr>`;
}

function renderEntriesTable(entries) {
  if (!entries.length) return '<div class="empty-state">Nenhuma saída encontrada para esse filtro.</div>';
  return `
    <div class="card card--table"><div class="table-scroll"><table>
      <tr><th>Data e hora</th><th>Funcionário</th><th>EPI</th><th>CA</th><th>Qtd.</th><th>Dev.</th><th>Cód.</th><th>Foto</th></tr>
      ${entries.map(renderEntryRow).join('')}
    </table></div></div>`;
}

/** Appends the filters and the outflow table to the dashboard. */
export function renderOutflowHistory() {
  const view = getOutflowView();
  const filters = getOutflowFilters();
  visibleEntries = view.entries;

  const units = view.entries.reduce((sum, entry) => sum + unitsOf(entry.quantityReceived), 0);
  const hasDateFilter = Boolean(filters.month || filters.fromDate || filters.toDate);
  const hasUndatedEntries = view.allEntries.some((entry) => !entry.deliveredAt);
  const undatedNote = hasDateFilter && hasUndatedEntries ? ' · registros sem data não aparecem com filtro' : '';

  byId('dashboard-view').insertAdjacentHTML('beforeend', `
    <p class="eyebrow outflow-section__eyebrow">Registro</p>
    <h2 class="section-title">Histórico de saídas de EPI</h2>
    ${renderFilterBar(view)}
    <p class="result-count">${view.entries.length} saída(s) · ${units} unidade(s)${undatedNote}</p>
    ${renderEntriesTable(view.entries)}`);
}

export function showDeliveryPhoto(entryPosition) {
  const entry = visibleEntries[entryPosition];
  const photo = entry && entry.photoId && appData.photos[entry.photoId];
  if (!photo) return;
  byId('photo-viewer-image').src = photo;
  byId('photo-viewer-caption').textContent = `${entry.employeeName} · ${entry.ppeName}${entry.deliveredAt ? ` · ${formatDateTime(entry.deliveredAt)}` : ''}`;
  showDialog('photo-viewer-dialog');
}
