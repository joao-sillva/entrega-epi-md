import { MAX_ITEMS_PER_SHEET } from '../../config/constants.js';
import { appData } from '../../state/app-data.js';
import { escapeHtml } from '../../utils/dom.js';

/** Company logo, loaded from the assets folder. */
export const LOGO_URL = new URL('../../../assets/logo.svg', import.meta.url).href;

const DECLARATION = 'Declaro que recebi os equipamentos de proteção individuais abaixo discriminados para serem usados no exercício de minhas funções. Tendo sido devidamente treinado para usar tais equipamentos, estou ciente de que o uso incorreto ou não utilização dos mesmos implica em insubordinação, sujeita as sanções disciplinares previstas nas normas estabelecidas por esta empresa. Minha assinatura ou rubrica posta no local indicado nesta ficha confirmam minha concordância.';

const FILL_CODES_LEGEND = 'Código de preenchimento:<br>01 – Primeira Entrega; 02 – Substituição por desgaste normal; 03 – Substituição por extravio;<br>04 – Substituição por desgaste anormal; 05 – Outros.';

const COLUMN_WIDTHS = ['11.5%', '27%', '10.5%', '11.5%', '8.5%', '8.5%', '22.5%'];

function renderItemRow(item) {
  const [day, time] = (item.deliveredAtText || '').split(/[\s,]+/);
  const signatureImage = appData.signatures[item.signatureId];
  return `<tr>
    <td>${escapeHtml(day || '')}${time ? `<br><small>${escapeHtml(time)}</small>` : ''}</td>
    <td>${escapeHtml(item.name)}</td>
    <td>${escapeHtml(item.quantityReceived)}</td>
    <td>${item.quantityReturned > 0 ? escapeHtml(item.quantityReturned) : ''}</td>
    <td>${escapeHtml(item.fillCode || '')}</td>
    <td>${escapeHtml(item.caNumber)}</td>
    <td>${signatureImage ? `<img src="${signatureImage}" alt="">` : ''}</td>
  </tr>`;
}

function renderSignatures(sheet) {
  const technician = sheet.technicianSignature;
  const technicianImage = technician ? appData.signatures[technician.signatureId] : '';
  const technicianNote = technician
    ? `<span class="ppe-sheet__signer-name">${escapeHtml(technician.name)}</span>`
    : '<span class="ppe-sheet__pending-note">(pendente — obrigatória antes da assinatura do funcionário)</span>';
  const employeeNote = sheet.employeeSignature
    ? ''
    : '<span class="ppe-sheet__pending-note">(pendente — obrigatória antes da entrega de EPI)</span>';

  return `<div class="ppe-sheet__signatures">
    <div>
      <div class="ppe-sheet__signature-line">${technicianImage ? `<img src="${technicianImage}" alt="">` : ''}</div>
      <b>Ass técnico de segurança</b>${technicianNote}
    </div>
    <div>
      <div class="ppe-sheet__signature-line">${sheet.employeeSignature ? `<img src="${sheet.employeeSignature}" alt="">` : ''}</div>
      <b>Ass Funcionário</b>${employeeNote}
    </div>
  </div>`;
}

/** HTML of one FORM. 87/3 sheet (the inside of the `.ppe-sheet` container). */
export function renderSheetMarkup(employee, sheet) {
  const emptyRow = `<tr>${'<td></td>'.repeat(7)}</tr>`;
  const rows = sheet.items.map(renderItemRow).join('')
    + emptyRow.repeat(Math.max(0, MAX_ITEMS_PER_SHEET - sheet.items.length));

  return `<div class="ppe-sheet__frame">
    <div class="ppe-sheet__header">
      <div class="ppe-sheet__logo"><img src="${LOGO_URL}" alt="Moura Dubeux"></div>
      <div class="ppe-sheet__title"><b>SISTEMA DE GESTÃO INTEGRADA</b><span>FICHA DE DISTRIBUIÇÃO DE E.P.I.</span></div>
    </div>
    <div class="ppe-sheet__fields">
      <div class="ppe-sheet__field-row">
        <span class="ppe-sheet__label">NOME:</span><span class="ppe-sheet__value">${escapeHtml(employee.name)}</span>
        <span class="ppe-sheet__label">MATRÍCULA:</span><span class="ppe-sheet__value ppe-sheet__value--short">${escapeHtml(employee.registrationNumber)}</span>
      </div>
      <div class="ppe-sheet__field-row">
        <span class="ppe-sheet__label">OBRA:</span><span class="ppe-sheet__value">${escapeHtml(employee.workSite)}</span>
        <span class="ppe-sheet__label">FUNÇÃO:</span><span class="ppe-sheet__value ppe-sheet__value--short">${escapeHtml(employee.role)}</span>
      </div>
    </div>
    <p class="ppe-sheet__declaration">${DECLARATION}</p>
    <table class="ppe-sheet__table">
      <colgroup>${COLUMN_WIDTHS.map((width) => `<col style="width:${width}">`).join('')}</colgroup>
      <tr>
        <th rowspan="2">Data</th><th rowspan="2">Especificação</th><th colspan="2">Quantidade</th>
        <th rowspan="2">Código</th><th rowspan="2">CA</th><th rowspan="2">Assinatura</th>
      </tr>
      <tr><th>Recebido</th><th>Devolvido</th></tr>
      ${rows}
    </table>
    <div class="ppe-sheet__codes">${FILL_CODES_LEGEND}</div>
    ${renderSignatures(sheet)}
    <div class="ppe-sheet__form-code">FORM. 87/3</div>
  </div>`;
}
