import { maskBrazilianDate } from '../utils/brazilian-date.js';
import { closeAllMenus } from './dropdown-menu.js';

/**
 * Event delegation for buttons and selects created by HTML templates.
 *
 * Markup declares `data-action="name"` (clicks) or `data-change-action="name"`
 * (value changes); features register one handler per name, so no inline
 * `onclick` attributes or global functions are needed.
 */
const clickHandlers = new Map();
const changeHandlers = new Map();

export function registerClickActions(handlersByName) {
  Object.entries(handlersByName).forEach(([name, handler]) => clickHandlers.set(name, handler));
}

export function registerChangeActions(handlersByName) {
  Object.entries(handlersByName).forEach(([name, handler]) => changeHandlers.set(name, handler));
}

export function listenForDelegatedEvents() {
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger || trigger.dataset.action !== 'toggle-menu') closeAllMenus();
    if (!trigger) return;
    const handler = clickHandlers.get(trigger.dataset.action);
    if (handler) handler(trigger.dataset, trigger, event);
  });

  // Fields marked data-date-mask show the dd/mm/aaaa slashes while the user types.
  document.addEventListener('input', (event) => {
    const field = event.target.closest('[data-date-mask]');
    if (!field) return;
    field.value = maskBrazilianDate(field.value);
    field.classList.remove('is-invalid');
  });

  document.addEventListener('change', (event) => {
    const field = event.target.closest('[data-change-action]');
    if (!field) return;
    const handler = changeHandlers.get(field.dataset.changeAction);
    if (handler) handler(field.value, field.dataset, field);
  });
}
