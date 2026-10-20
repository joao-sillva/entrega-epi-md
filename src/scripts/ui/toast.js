import { byId, escapeHtml } from '../utils/dom.js';

/**
 * Shows a temporary notification.
 * @param {string} title
 * @param {string} [description]
 * @param {'success'|'error'} [kind]
 */
export function showToast(title, description = '', kind = 'success') {
  const isError = kind === 'error';
  const toast = document.createElement('div');
  toast.className = `toast${isError ? ' toast--error' : ''}`;
  toast.setAttribute('role', isError ? 'alert' : 'status');
  toast.innerHTML = `
    <div class="toast__icon">${isError ? '!' : '✓'}</div>
    <div><b>${escapeHtml(title)}</b><span>${escapeHtml(description)}</span></div>
    <button type="button" aria-label="Fechar">×</button>
    <div class="toast__progress"></div>`;

  let isClosing = false;
  const close = () => {
    if (isClosing) return;
    isClosing = true;
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 270);
  };
  toast.querySelector('button').addEventListener('click', close);
  toast.querySelector('.toast__progress').addEventListener('animationend', close);
  byId('toast-region').appendChild(toast);
}

export const showErrorToast = (title, description = '') => showToast(title, description, 'error');
