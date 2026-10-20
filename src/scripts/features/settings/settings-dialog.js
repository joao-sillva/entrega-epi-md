import { byId, showDialog } from '../../utils/dom.js';
import {
  CAEPI_IMPORT_ERROR,
  describeCaepiDatabase,
  importCaepiFile,
  isUsingDefaultCaepi,
  hasCaepiDatabase,
  restoreDefaultCaepiDatabase,
} from './caepi-database.js';
import { refreshBackupInfo } from './backup.js';
import { refreshStorageInfo } from './storage-usage.js';

const MUTED_COLOR = 'var(--color-muted)';
const ERROR_COLOR = '#c0392b';

function showSettingsMessage(text, color = MUTED_COLOR) {
  const message = byId('settings-message');
  message.style.color = color;
  message.textContent = text;
}

export function refreshCaepiInfo() {
  byId('caepi-info').textContent = describeCaepiDatabase();
  byId('caepi-restore-default-button').hidden = isUsingDefaultCaepi() || !hasCaepiDatabase();
}

export function openSettingsDialog() {
  showSettingsMessage('');
  refreshCaepiInfo();
  refreshBackupInfo();
  refreshStorageInfo();
  showDialog('settings-dialog');
}

/* ---------- CAEPI import ---------- */

function describeImportFailure(error) {
  if (error.message === CAEPI_IMPORT_ERROR.columnsNotFound) {
    return `Não achei as colunas do CA e do nome do equipamento. Primeira linha lida: "${(error.firstLine || '').slice(0, 160)}"`;
  }
  if (error.message === CAEPI_IMPORT_ERROR.zipUnreadable) {
    return 'Não consegui abrir o .zip. Extraia e escolha o .csv ou .txt de dentro.';
  }
  return `Não consegui ler o arquivo (${error && error.message ? error.message : 'erro desconhecido'}). Preciso de uma coluna com o número do CA e outra com o nome do equipamento (.zip, .csv, .txt ou .xlsx).`;
}

async function importChosenCaepiFile(file) {
  showSettingsMessage('Lendo a base de CAs... pode levar alguns segundos.');
  try {
    const result = await importCaepiFile(file, (rowCount) => {
      byId('settings-message').textContent = `Lendo... ${rowCount.toLocaleString('pt-BR')} CAs`;
    });
    refreshCaepiInfo();
    const unsavedWarning = result.savedInBrowser
      ? ''
      : ' Atenção: não consegui salvar no navegador, então será preciso importar de novo ao reabrir o site.';
    showSettingsMessage(`Base importada: ${result.recordCount.toLocaleString('pt-BR')} CAs (${result.rowCount.toLocaleString('pt-BR')} linhas lidas).${unsavedWarning}`);
  } catch (error) {
    showSettingsMessage(describeImportFailure(error), ERROR_COLOR);
  }
}

export async function restoreDefaultCaepi() {
  const isDefaultAgain = await restoreDefaultCaepiDatabase();
  refreshCaepiInfo();
  showSettingsMessage(isDefaultAgain ? 'Voltou para a base padrão do sistema.' : 'Base removida.');
}

export function bindCaepiFileInput() {
  byId('caepi-file-input').addEventListener('change', (event) => {
    const [file] = event.target.files;
    event.target.value = '';
    if (file) importChosenCaepiFile(file);
  });
}

export const chooseCaepiFile = () => byId('caepi-file-input').click();
