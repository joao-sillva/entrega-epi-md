import { getCurrentAccount, saveAccount } from '../../storage/accounts.js';
import { byId } from '../../utils/dom.js';

/**
 * Shows the step-by-step guide.
 * @param {{openedFromSettings: boolean}} options  From settings it can simply be closed.
 */
export function showGuide({ openedFromSettings }) {
  const account = getCurrentAccount();
  const firstName = account ? account.fullName.split(' ')[0] : '';
  byId('guide-title').textContent = `Bem-vindo(a)${account ? `, ${firstName}` : ''}`;
  byId('guide-confirm-button').textContent = openedFromSettings ? 'Fechar' : 'Entendi, começar a usar';
  byId('guide-note').hidden = openedFromSettings;
  const guide = byId('onboarding-guide');
  guide.hidden = false;
  guide.scrollTop = 0;
}

export function hideGuide() {
  byId('onboarding-guide').hidden = true;
}

/** Records that the user read the guide so it is not shown again at login. */
export function confirmGuide() {
  const account = getCurrentAccount();
  if (account && !account.guideAcknowledgedAt) {
    account.guideAcknowledgedAt = Date.now();
    saveAccount(account);
  }
  hideGuide();
}
