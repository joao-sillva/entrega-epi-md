import { ACCOUNT_RULES } from '../../config/constants.js';
import {
  createSalt,
  findAccount,
  getCurrentAccount,
  hashPassword,
  isPasswordHashingAvailable,
  passwordMatches,
  replaceAccount,
  setSessionUsername,
} from '../../storage/accounts.js';
import { renameAccountData } from '../../storage/data-repository.js';
import { appData } from '../../state/app-data.js';
import { byId, clearInputs, closeDialog, showDialog } from '../../utils/dom.js';
import { capitalizeName } from '../../utils/text.js';
import { showToast } from '../../ui/toast.js';
import { showSignedInAccount } from './session.js';

const PASSWORD_INPUT_IDS = [
  'profile-current-password-input',
  'profile-new-password-input',
  'profile-confirm-password-input',
];

export function openProfileDialog() {
  const account = getCurrentAccount();
  if (!account) return;
  byId('profile-full-name-input').value = account.fullName;
  byId('profile-username-input').value = account.username;
  clearInputs(PASSWORD_INPUT_IDS);
  byId('profile-error').textContent = '';
  showDialog('profile-dialog');
}

function readProfileForm() {
  return {
    fullName: capitalizeName(byId('profile-full-name-input').value.trim()),
    username: byId('profile-username-input').value.trim().toLowerCase(),
    currentPassword: byId('profile-current-password-input').value,
    newPassword: byId('profile-new-password-input').value,
    passwordConfirmation: byId('profile-confirm-password-input').value,
  };
}

/** Returns an error message, or an empty string when the form is valid. */
async function validateProfileForm(account, form, { changesUsername, changesPassword }) {
  if (form.fullName.length < ACCOUNT_RULES.minimumFullNameLength) return 'Informe o nome completo.';
  if (!ACCOUNT_RULES.usernamePattern.test(form.username)) {
    return 'Usuário: mínimo de 3 caracteres, só letras, números, ponto, hífen ou _.';
  }
  if (changesUsername && findAccount(form.username)) return 'Este usuário já existe. Escolha outro.';
  if (changesPassword) {
    if (form.newPassword.length < ACCOUNT_RULES.minimumPasswordLength) {
      return 'A nova senha precisa ter ao menos 6 caracteres.';
    }
    if (form.newPassword !== form.passwordConfirmation) return 'A confirmação da nova senha não confere.';
  }
  if (changesUsername || changesPassword) {
    if (!form.currentPassword) return 'Informe a senha atual para trocar usuário ou senha.';
    if (!isPasswordHashingAvailable()) return 'Este navegador não permite trocar a senha com segurança.';
    if (!(await passwordMatches(account, form.currentPassword))) return 'Senha atual incorreta.';
  }
  return '';
}

export async function saveProfile() {
  const account = getCurrentAccount();
  const errorElement = byId('profile-error');
  if (!account) return;

  const form = readProfileForm();
  const changesUsername = form.username !== account.username;
  const changesPassword = Boolean(form.newPassword || form.passwordConfirmation);
  const validationError = await validateProfileForm(account, form, { changesUsername, changesPassword });
  if (validationError) {
    errorElement.textContent = validationError;
    return;
  }

  const updatedAccount = { ...account, fullName: form.fullName, username: form.username };
  if (changesPassword) {
    updatedAccount.passwordSalt = createSalt();
    updatedAccount.passwordHash = await hashPassword(form.newPassword, updatedAccount.passwordSalt);
  }
  replaceAccount(account.username, updatedAccount);

  if (changesUsername) {
    setSessionUsername(updatedAccount.username);
    renameAccountData(account.username, updatedAccount.username, appData);
  }

  showSignedInAccount(updatedAccount);
  closeDialog('profile-dialog');
  showToast('Perfil atualizado', changesPassword ? 'Dados e senha salvos.' : 'Dados salvos.');
}
