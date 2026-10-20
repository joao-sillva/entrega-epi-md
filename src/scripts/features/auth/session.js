import { loadRawAccountData } from '../../storage/data-repository.js';
import { migrateAccountData } from '../../storage/schema-migration.js';
import { getCurrentAccount, setSessionUsername } from '../../storage/accounts.js';
import { createEmptyAppData, replaceAppData, resetAppData } from '../../state/app-data.js';
import { persistAppData, requestRender } from '../../state/change-notifier.js';
import { byId } from '../../utils/dom.js';
import { getInitials } from '../../utils/text.js';
import { showView } from '../../ui/navigation.js';
import { resetEmployeeListPosition } from '../employees/employee-list.js';
import { showLoginGate } from './login-gate.js';
import { hideGuide, showGuide } from './onboarding-guide.js';

/** Shows the account's initials in the header profile button. */
export function showSignedInAccount(account) {
  byId('profile-initials').textContent = getInitials(account.fullName);
  byId('profile-button').title = `Meu perfil · ${account.fullName}`;
  byId('profile-button').hidden = false;
}

async function loadAccountData(account) {
  const storedData = await loadRawAccountData(account.username);
  replaceAppData(migrateAccountData(storedData) || createEmptyAppData());
  persistAppData();
  resetEmployeeListPosition();
  requestRender();
  showView('employees');
}

function requestPersistentStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch (error) {
    // The browser decides on its own; nothing to do.
  }
}

/** Starts a session: loads the account's data and reveals the application. */
export async function enterAccount(account) {
  setSessionUsername(account.username);
  await loadAccountData(account);
  requestPersistentStorage();
  byId('login-gate').hidden = true;
  showSignedInAccount(account);
  if (!account.guideAcknowledgedAt) showGuide({ openedFromSettings: false });
}

export function signOut() {
  setSessionUsername(null);
  resetAppData();
  requestRender();
  byId('profile-button').hidden = true;
  hideGuide();
  showLoginGate('login');
}

/** Resumes the session of this tab, or shows the login gate. */
export function startApplicationSession() {
  const account = getCurrentAccount();
  if (account) enterAccount(account);
  else showLoginGate();
}
