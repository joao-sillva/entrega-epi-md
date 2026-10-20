import { ACCOUNT_RULES } from '../../config/constants.js';
import {
  createSalt,
  findAccount,
  getAccounts,
  getLoginLockRemainingSeconds,
  hashPassword,
  isPasswordHashingAvailable,
  passwordMatches,
  registerFailedLogin,
  removeAccount,
  resetFailedLogins,
  saveAccount,
  setSessionUsername,
} from '../../storage/accounts.js';
import { byId } from '../../utils/dom.js';
import { capitalizeName } from '../../utils/text.js';
import { enterAccount } from './session.js';

const MESSAGES = {
  fullNameRequired: 'Informe o nome completo.',
  usernameInvalid: 'Usuário: mínimo de 3 caracteres, só letras, números, ponto, hífen ou _.',
  usernameTaken: 'Este usuário já existe. Escolha outro ou volte e entre.',
  passwordTooShort: 'A senha precisa ter ao menos 6 caracteres.',
  passwordsDiffer: 'As senhas não conferem.',
  hashingUnavailable: 'Este navegador não permite criar a senha com segurança.',
  invalidCredentials: 'Usuário ou senha incorretos.',
  tooManyAttempts: (seconds) => `Muitas tentativas. Aguarde ${seconds}s.`,
  usernameNeededForReset: 'Digite o seu usuário no campo acima para redefinir o acesso dele.',
};

/**
 * Shows the gate in "create" or "login" mode. With no account registered yet
 * the creation form is always shown.
 */
export function showLoginGate(requestedMode) {
  const hasAccounts = getAccounts().length > 0;
  const mode = hasAccounts ? requestedMode || 'login' : 'create';

  byId('login-gate').hidden = false;
  byId('create-account-section').hidden = mode !== 'create';
  byId('login-section').hidden = mode !== 'login';
  byId('forgot-password-panel').hidden = true;
  byId('switch-to-login').hidden = !hasAccounts;
  byId('create-account-title').textContent = hasAccounts ? 'Crie sua conta' : 'Crie seu acesso';
  byId('create-account-subtitle').textContent = hasAccounts
    ? 'Preencha os dados para criar um novo acesso.'
    : 'Defina um usuário e uma senha para usar o controle de entrega de EPI neste dispositivo.';

  ['create-password-input', 'create-password-confirm-input', 'login-password-input'].forEach((inputId) => {
    byId(inputId).value = '';
  });
  byId('create-account-error').textContent = '';
  byId('login-error').textContent = '';
  setTimeout(() => {
    byId(mode === 'create' ? 'create-full-name-input' : 'login-username-input').focus();
  }, 60);
}

function validateNewAccountForm({ fullName, username, password, passwordConfirmation }) {
  if (fullName.length < ACCOUNT_RULES.minimumFullNameLength) return MESSAGES.fullNameRequired;
  if (!ACCOUNT_RULES.usernamePattern.test(username)) return MESSAGES.usernameInvalid;
  if (findAccount(username)) return MESSAGES.usernameTaken;
  if (password.length < ACCOUNT_RULES.minimumPasswordLength) return MESSAGES.passwordTooShort;
  if (password !== passwordConfirmation) return MESSAGES.passwordsDiffer;
  if (!isPasswordHashingAvailable()) return MESSAGES.hashingUnavailable;
  return '';
}

async function createAccount(event) {
  event.preventDefault();
  const errorElement = byId('create-account-error');
  const form = {
    fullName: byId('create-full-name-input').value.trim(),
    username: byId('create-username-input').value.trim().toLowerCase(),
    password: byId('create-password-input').value,
    passwordConfirmation: byId('create-password-confirm-input').value,
  };
  const validationError = validateNewAccountForm(form);
  if (validationError) {
    errorElement.textContent = validationError;
    return;
  }

  const passwordSalt = createSalt();
  const account = {
    fullName: capitalizeName(form.fullName),
    username: form.username,
    passwordSalt,
    passwordHash: await hashPassword(form.password, passwordSalt),
    createdAt: Date.now(),
    guideAcknowledgedAt: 0,
  };
  saveAccount(account);
  enterAccount(account);
}

async function login(event) {
  event.preventDefault();
  const errorElement = byId('login-error');
  const remainingLockSeconds = getLoginLockRemainingSeconds();
  if (remainingLockSeconds > 0) {
    errorElement.textContent = MESSAGES.tooManyAttempts(remainingLockSeconds);
    return;
  }

  const account = findAccount(byId('login-username-input').value.trim().toLowerCase());
  const credentialsAreValid = account && await passwordMatches(account, byId('login-password-input').value);
  if (!credentialsAreValid) {
    const justLocked = registerFailedLogin();
    errorElement.textContent = justLocked
      ? MESSAGES.tooManyAttempts(ACCOUNT_RULES.loginLockMilliseconds / 1000)
      : MESSAGES.invalidCredentials;
    return;
  }
  resetFailedLogins();
  enterAccount(account);
}

export function toggleForgotPasswordNotice() {
  const notice = byId('forgot-password-panel');
  notice.hidden = !notice.hidden;
}

/** Removes the account credentials (not its data) so the user can register again. */
export function resetAccountAccess() {
  const username = byId('login-username-input').value.trim().toLowerCase();
  const account = findAccount(username);
  if (!account) {
    byId('login-error').textContent = MESSAGES.usernameNeededForReset;
    return;
  }
  removeAccount(username);
  setSessionUsername(null);
  showLoginGate('create');
  byId('create-username-input').value = username;
  byId('create-full-name-input').value = account.fullName;
}

export function togglePasswordVisibility(inputId) {
  const input = byId(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
}

export function bindLoginGateForms() {
  byId('create-account-form').addEventListener('submit', createAccount);
  byId('login-form').addEventListener('submit', login);
}
