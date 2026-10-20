import { appData } from '../../state/app-data.js';
import { byId } from '../../utils/dom.js';

const STORAGE_WARNING_PERCENT = 70;

const formatSize = (bytes) => (bytes >= 1048576
  ? `${(bytes / 1048576).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Shows how much space this account's data uses and warns when the browser is nearly full. */
export async function refreshStorageInfo() {
  const element = byId('storage-info');
  let dataSize = 0;
  try {
    dataSize = JSON.stringify(appData).length;
  } catch (error) {
    dataSize = 0;
  }

  let text = `Dados desta conta neste navegador: ${formatSize(dataSize)}. Ficam guardados no banco de dados do navegador.`;
  let isNearlyFull = false;
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const { usage = 0, quota } = await navigator.storage.estimate();
      if (quota) {
        const usedPercent = Math.round((usage / quota) * 100);
        text += ` Espaço do navegador usado: ${usedPercent}%.`;
        isNearlyFull = usedPercent >= STORAGE_WARNING_PERCENT;
      }
    }
  } catch (error) {
    // The estimate is optional.
  }
  element.style.color = isNearlyFull ? 'var(--color-warning)' : 'var(--color-muted)';
  element.textContent = text + (isNearlyFull ? ' Faça um backup e libere espaço.' : '');
}

