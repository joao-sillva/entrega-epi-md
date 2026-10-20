import { BACKUP_APP_NAME, FILE_MIME_TYPES, SCHEMA_VERSION } from '../../config/constants.js';
import { appData, replaceAppData } from '../../state/app-data.js';
import { commitChanges, persistAppData } from '../../state/change-notifier.js';
import { countDeliveredItems } from '../../domain/ppe-items.js';
import { parseBackupFile } from '../../storage/schema-migration.js';
import { byId } from '../../utils/dom.js';
import { formatLocalDateTimeShort, toIsoDate } from '../../utils/date.js';
import { DOWNLOAD_DECLINED, saveFile } from '../../utils/file-download.js';
import { resetEmployeeListPosition } from '../employees/employee-list.js';
import { refreshStorageInfo } from './storage-usage.js';

/** Backup data waiting for the user's confirmation to replace the current data. */
let pendingBackupData = null;

const MUTED_COLOR = 'var(--color-muted)';
const ERROR_COLOR = '#c0392b';

function showBackupMessage(text, color = MUTED_COLOR) {
  const message = byId('backup-message');
  message.style.color = color;
  message.textContent = text;
}

function hideBackupConfirmation() {
  pendingBackupData = null;
  byId('backup-confirmation').hidden = true;
}

export function refreshBackupInfo() {
  byId('backup-info').textContent = appData.lastBackupAt
    ? `Último backup: ${formatLocalDateTimeShort(appData.lastBackupAt)}`
    : 'Nenhum backup feito ainda';
}

export async function downloadBackup() {
  showBackupMessage('');
  try {
    const now = new Date();
    const fileName = `backup-epi-${toIsoDate(now)}.json`;
    const backup = {
      app: BACKUP_APP_NAME,
      version: SCHEMA_VERSION,
      generatedAt: now.toISOString(),
      data: appData,
    };
    const result = await saveFile(fileName, JSON.stringify(backup), FILE_MIME_TYPES.json);
    if (result === DOWNLOAD_DECLINED) return;
    appData.lastBackupAt = Date.now();
    persistAppData();
    refreshBackupInfo();
    refreshStorageInfo();
    showBackupMessage(`Backup gerado: ${appData.employees.length} funcionário(s).`);
  } catch (error) {
    showBackupMessage('Não consegui gerar o backup.', ERROR_COLOR);
  }
}

/** Reads the chosen backup file and asks the user to confirm before replacing the data. */
async function prepareBackupRestore(file) {
  showBackupMessage('');
  try {
    const { data, generatedAt } = parseBackupFile(JSON.parse(await file.text()));
    pendingBackupData = data;
    const generatedText = generatedAt ? formatLocalDateTimeShort(generatedAt) : 'data desconhecida';
    const itemCount = data.employees.reduce((sum, employee) => sum + countDeliveredItems(employee), 0);
    showBackupMessage(`Backup de ${generatedText}: ${data.employees.length} funcionário(s) e ${itemCount} EPI(s). Restaurar vai SUBSTITUIR os dados atuais (${appData.employees.length} funcionário(s)).`);
    byId('backup-confirmation').hidden = false;
  } catch (error) {
    hideBackupConfirmation();
    showBackupMessage('Arquivo inválido: escolha um backup gerado por este site (.json).', ERROR_COLOR);
  }
}

export function confirmBackupRestore() {
  if (!pendingBackupData) return;
  replaceAppData(pendingBackupData);
  hideBackupConfirmation();
  resetEmployeeListPosition();
  commitChanges();
  showBackupMessage(`Backup restaurado: ${appData.employees.length} funcionário(s).`);
  refreshBackupInfo();
}

export function cancelBackupRestore() {
  hideBackupConfirmation();
  showBackupMessage('');
}

export function bindBackupFileInput() {
  byId('backup-file-input').addEventListener('change', (event) => {
    const [file] = event.target.files;
    event.target.value = '';
    if (file) prepareBackupRestore(file);
  });
}

export const chooseBackupFile = () => byId('backup-file-input').click();
