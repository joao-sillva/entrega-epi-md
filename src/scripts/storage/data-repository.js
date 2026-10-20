import { DATABASE, STORAGE_KEYS } from '../config/constants.js';
import { getAccounts } from './accounts.js';
import { openKeyValueStore } from './browser-database.js';

/**
 * Per-account data persistence.
 *
 * Data lives in IndexedDB (large capacity). `localStorage` is only a fallback
 * used when IndexedDB cannot be written, and for reading data saved by older
 * versions of the system.
 */
const accountDataStore = openKeyValueStore(DATABASE.accountData);
const storageKeyFor = (username) => STORAGE_KEYS.accountDataPrefix + username;

let writeQueue = Promise.resolve();
let saveFailureHandler = () => {};

export function setSaveFailureHandler(handler) {
  saveFailureHandler = handler;
}

/** Writes are serialized so the latest snapshot always wins. */
export function saveAccountData(username, data) {
  const storageKey = storageKeyFor(username);
  const serialized = JSON.stringify(data);
  writeQueue = writeQueue
    .then(() => accountDataStore.write(storageKey, serialized))
    .then(() => removeFallbackCopy(storageKey))
    .catch(() => {
      try {
        localStorage.setItem(storageKey, serialized);
      } catch (error) {
        saveFailureHandler();
      }
    });
}

function removeFallbackCopy(storageKey) {
  try {
    localStorage.removeItem(storageKey);
  } catch (error) {
    // Nothing to clean up.
  }
}

/** Waits until every queued write reached the database. */
export const waitForPendingWrites = () => writeQueue;

/**
 * Reads the raw stored data of an account (any schema version) or null.
 * Checks, in order: the localStorage fallback copy, IndexedDB, and the single
 * shared key used by the first versions of the system.
 */
export async function loadRawAccountData(username) {
  const storageKey = storageKeyFor(username);

  try {
    const fallbackCopy = localStorage.getItem(storageKey);
    if (fallbackCopy) return JSON.parse(fallbackCopy);
  } catch (error) {
    // Ignore unreadable fallback copy.
  }

  try {
    await writeQueue;
    const stored = await accountDataStore.read(storageKey);
    if (stored) return JSON.parse(stored);
  } catch (error) {
    // Fall through to the legacy key.
  }

  return loadLegacySingleAccountData(username, storageKey);
}

/** Before accounts existed, one key held the data; it belongs to the oldest account. */
function loadLegacySingleAccountData(username, storageKey) {
  try {
    const legacyData = localStorage.getItem(STORAGE_KEYS.legacySingleAccountData);
    if (!legacyData) return null;
    const oldestAccount = getAccounts().slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))[0];
    if (!oldestAccount || oldestAccount.username !== username) return null;
    localStorage.setItem(storageKey, legacyData);
    localStorage.removeItem(STORAGE_KEYS.legacySingleAccountData);
    return JSON.parse(legacyData);
  } catch (error) {
    return null;
  }
}

/** Moves the stored data to a new username (used when the user renames the account). */
export function renameAccountData(previousUsername, nextUsername, data) {
  saveAccountData(nextUsername, data);
  const previousKey = storageKeyFor(previousUsername);
  writeQueue = writeQueue.then(() => accountDataStore.remove(previousKey)).catch(() => {});
  removeFallbackCopy(previousKey);
}
