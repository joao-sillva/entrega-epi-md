/** Small DOM helpers shared by every feature. */

export const byId = (elementId) => document.getElementById(elementId);

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/** Escapes text so it can be safely placed inside an HTML template string. */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (character) => HTML_ESCAPES[character]);
}

/** Sets the text of an element and optionally its CSS color variable. */
export function setMessage(elementId, text, color = '') {
  const element = byId(elementId);
  element.textContent = text;
  element.style.color = color;
}

export function showDialog(dialogId) {
  byId(dialogId).showModal();
}

export function closeDialog(dialogId) {
  byId(dialogId).close();
}

export function setElementsText(textById) {
  Object.entries(textById).forEach(([elementId, text]) => {
    byId(elementId).textContent = text;
  });
}

export function clearInputs(inputIds) {
  inputIds.forEach((inputId) => {
    byId(inputId).value = '';
  });
}
