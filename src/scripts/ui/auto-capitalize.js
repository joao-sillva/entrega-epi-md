import { byId } from '../utils/dom.js';
import { capitalizeName } from '../utils/text.js';

/** Capitalizes names while typing, keeping the caret where the user left it. */
export function enableNameCapitalization(inputIds) {
  inputIds.forEach((inputId) => {
    byId(inputId).addEventListener('input', (event) => {
      const input = event.target;
      const caretPosition = input.selectionStart;
      const capitalized = capitalizeName(input.value);
      if (capitalized !== input.value) {
        input.value = capitalized;
        input.setSelectionRange(caretPosition, caretPosition);
      }
    });
  });
}
