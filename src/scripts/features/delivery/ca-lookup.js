import { appData } from '../../state/app-data.js';
import { getAllItemsOldestFirst } from '../../domain/ppe-items.js';
import { byId } from '../../utils/dom.js';
import { formatUtcDate, parseValidityDate } from '../../utils/date.js';
import { capitalizeName } from '../../utils/text.js';
import {
  findCaepiRecord,
  getCaepiReferenceTimestamp,
  hasCaepiDatabase,
  isUsingDefaultCaepi,
} from '../settings/caepi-database.js';

/**
 * Fills the PPE name from the CA number typed in the delivery dialog.
 *
 * Sources, in order: the CAEPI database, the cache of earlier web lookups,
 * PPE already delivered with the same CA and, inside Claude, a web lookup on
 * consultaCA through the Parallel Search connector.
 */
const WEB_LOOKUP_DELAY_MS = 800;
const WEB_LOOKUP_TIMEOUT_MS = 45000;
const MINIMUM_CA_DIGITS = 3;
const CONNECTOR_ERROR_CODES = [
  'server_not_connected', 'not_in_manifest', 'needs_reauth', 'selection_required',
  'blocked_by_policy', 'not_granted', 'consent_required', 'approval_required',
];
const SESSION_ID = (window.crypto && crypto.randomUUID)
  ? crypto.randomUUID()
  : String(Date.now()) + Math.random().toString(16).slice(2);

const isRunningInsideClaude = () => typeof claude !== 'undefined';
const MUTED_COLOR = 'var(--color-muted)';
const ERROR_COLOR = '#c0392b';

/**
 * Extracts name, validity and situation from the consultaCA search result,
 * or returns null when the page is not the expected CA.
 */
function parseConsultaCaResult(caNumber, payload) {
  let parsedPayload = payload;
  if (typeof parsedPayload === 'string') {
    try {
      parsedPayload = JSON.parse(parsedPayload);
    } catch (error) {
      parsedPayload = null;
    }
  }
  const result = parsedPayload && parsedPayload.results && parsedPayload.results[0];
  if (!result) return null;

  const title = (result.title || '').replace(/\s+/g, ' ').trim();
  const excerpts = (result.excerpts || []).join('\n');
  const titleMatch = new RegExp(`^CA\\s*${caNumber}\\s*-\\s*(.+)$`).exec(title);
  if (!titleMatch) return null;

  const heading = ((/^#\s+(.+)$/m.exec(excerpts) || [])[1] || '').trim();
  let name = '';
  if (heading && titleMatch[1].toUpperCase().startsWith(heading.toUpperCase())) {
    name = heading;
  } else {
    const titleParts = titleMatch[1].split(' - ');
    if (titleParts.length > 1) titleParts.pop();
    name = titleParts.join(' - ').trim();
  }
  if (!name) return null;

  return {
    name,
    validUntil: (/\*\*Validade:\*\*\s*(\d{2}\/\d{2}\/\d{4})/.exec(excerpts) || [])[1] || '',
    situation: ((/\*\*Situa[çc][ãa]o:\*\*\s*([^\n*]+)/.exec(excerpts) || [])[1] || '').trim(),
  };
}

/**
 * @param {{ setSuggestedName: (name: string) => void, clearSuggestedName: () => void }} hooks
 *   Callbacks used to put (or remove) the suggested name in the PPE name field.
 */
export function createCaLookup({ setSuggestedName, clearSuggestedName }) {
  let lookupSequence = 0;
  let webLookupTimer = null;

  const showMessage = (text, color = MUTED_COLOR) => {
    const message = byId('ca-message');
    message.style.color = color;
    message.textContent = text;
  };

  const readCaDigits = () => byId('ca-number-input').value.replace(/\D/g, '');

  function showRecordFound(record, sourceLabel) {
    setSuggestedName(capitalizeName(record.name));
    const validityDate = parseValidityDate(record.validUntil);
    const isInvalid = (record.situation && !/^v[aá]lid/i.test(record.situation))
      || (validityDate && validityDate < new Date());
    const databaseDate = isUsingDefaultCaepi() && sourceLabel === 'CAEPI'
      ? ` (base de ${formatUtcDate(getCaepiReferenceTimestamp())})`
      : '';
    const validityText = record.validUntil ? ` · validade ${record.validUntil}` : '';
    showMessage(
      isInvalid
        ? `⚠ CA ${record.situation || 'vencido'}${validityText}${databaseDate} — confira antes de entregar.`
        : `✔ Nome preenchido pelo ${sourceLabel}${validityText}${databaseDate}`,
      isInvalid ? ERROR_COLOR : MUTED_COLOR,
    );
  }

  /** Looks the CA up on consultaCA (only available inside Claude). */
  async function lookUpOnWeb(caNumber, { ignoreTypingChanges = false } = {}) {
    if (!ignoreTypingChanges && readCaDigits() !== caNumber) return;
    const cachedRecord = appData.caLookupCache[caNumber];
    if (cachedRecord) {
      showRecordFound(cachedRecord, 'consultaCA');
      return;
    }
    if (!isRunningInsideClaude()) return;

    let connector = null;
    try {
      connector = await claude.use('mcp');
    } catch (error) {
      connector = null;
    }
    if (!connector) return;

    lookupSequence += 1;
    const thisLookup = lookupSequence;
    showMessage('Consultando o consultaCA...');
    try {
      const response = await connector.callTool('Parallel Search', 'web_fetch', {
        urls: [`https://consultaca.com/${caNumber}`],
        objective: 'Extract the page title and the equipment name (EQUIPAMENTO) for this CA',
        session_id: SESSION_ID,
      }, { signal: AbortSignal.timeout(WEB_LOOKUP_TIMEOUT_MS) });

      if (thisLookup !== lookupSequence || readCaDigits() !== caNumber) return;
      const payload = response.payload !== undefined
        ? response.payload
        : (response.content && response.content[0] && response.content[0].text);
      const record = parseConsultaCaResult(caNumber, payload);
      if (!record) {
        showMessage('CA não localizado no consultaCA. Digite o nome do EPI.');
        return;
      }
      appData.caLookupCache[caNumber] = record;
      showRecordFound(record, 'consultaCA');
    } catch (error) {
      if (thisLookup !== lookupSequence) return;
      showMessage(
        CONNECTOR_ERROR_CODES.includes(error && error.code)
          ? 'Não deu para usar o conector Parallel Search (conecte ou autorize no Claude). Digite o nome do EPI.'
          : 'Não consegui consultar o consultaCA agora. Digite o nome ou tente de novo.',
        ERROR_COLOR,
      );
    }
  }

  function findNameOfPreviouslyDeliveredItem(caNumber) {
    let name = '';
    appData.employees.forEach((employee) => {
      getAllItemsOldestFirst(employee).forEach((item) => {
        if (item.caNumber === caNumber && item.name) name = item.name;
      });
    });
    return name;
  }

  /** Runs on every keystroke in the CA field. */
  function handleCaNumberInput() {
    const input = byId('ca-number-input');
    const caNumber = readCaDigits();
    input.value = caNumber;
    clearTimeout(webLookupTimer);
    lookupSequence += 1;
    showMessage('');
    if (!caNumber) return;

    const databaseRecord = findCaepiRecord(caNumber);
    if (databaseRecord) {
      showRecordFound(databaseRecord, 'CAEPI');
      return;
    }
    const cachedRecord = appData.caLookupCache[caNumber];
    if (cachedRecord) {
      showRecordFound(cachedRecord, 'consultaCA');
      return;
    }
    const knownName = findNameOfPreviouslyDeliveredItem(caNumber);
    if (knownName) {
      setSuggestedName(knownName);
      showMessage('Nome preenchido por um EPI já cadastrado com este CA.');
      return;
    }

    clearSuggestedName();
    if (isRunningInsideClaude()) {
      showMessage('Consultando o CA... Se não preencher, digite o nome do EPI.');
      if (caNumber.length >= MINIMUM_CA_DIGITS) {
        webLookupTimer = setTimeout(() => lookUpOnWeb(caNumber), WEB_LOOKUP_DELAY_MS);
      }
    } else {
      showMessage(hasCaepiDatabase()
        ? 'CA não encontrado na base do CAEPI. Digite o nome do EPI.'
        : 'Digite o nome do EPI, ou importe a base do CAEPI em Configuração para preencher pelo CA.');
    }
  }

  return {
    handleCaNumberInput,
    lookUpOnWeb,
    clearMessage: () => showMessage(''),
  };
}
