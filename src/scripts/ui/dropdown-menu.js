import { byId } from '../utils/dom.js';

export function closeAllMenus() {
  document.querySelectorAll('.dropdown-menu.is-open').forEach((menu) => menu.classList.remove('is-open'));
}

/** Opens the menu, or closes it when it was already open. */
export function toggleMenu(menuId) {
  const menu = byId(menuId);
  const wasOpen = menu.classList.contains('is-open');
  closeAllMenus();
  if (!wasOpen) menu.classList.add('is-open');
}
