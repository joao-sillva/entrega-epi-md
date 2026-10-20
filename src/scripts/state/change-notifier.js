import { appData } from './app-data.js';
import { getSessionUsername } from '../storage/accounts.js';
import { saveAccountData } from '../storage/data-repository.js';

const listeners = new Set();

/** Registers a function called whenever the data changed and the screen must refresh. */
export function onAppDataChanged(listener) {
  listeners.add(listener);
}

export function requestRender() {
  listeners.forEach((listener) => listener());
}

/** Writes the current data of the signed-in account to the browser database. */
export function persistAppData() {
  const username = getSessionUsername();
  if (username) saveAccountData(username, appData);
}

/** Persists the data and refreshes every screen. */
export function commitChanges() {
  persistAppData();
  requestRender();
}
