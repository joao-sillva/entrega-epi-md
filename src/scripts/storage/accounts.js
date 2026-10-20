import { ACCOUNT_RULES, STORAGE_KEYS } from '../config/constants.js';
import { migrateAccountRecord } from './schema-migration.js';

/**
 * @typedef {Object} Account
 * @property {string} fullName
 * @property {string} username
 * @property {string} passwordSalt
 * @property {string} passwordHash
 * @property {number} createdAt
 * @property {number} guideAcknowledgedAt   0 until the user confirms the onboarding guide.
 */

/* ---------- Account list (localStorage) ---------- */

function writeAccounts(accounts) {
  try {
    localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts));
  } catch (error) {
    // Storage blocked or full: the account simply will not persist.
  }
}

/** @returns {Account[]} */
export function getAccounts() {
  let storedAccounts = [];
  try {
    storedAccounts = JSON.parse(localStorage.getItem(STORAGE_KEYS.accounts) || 'null') || [];
  } catch (error) {
    storedAccounts = [];
  }

  if (!storedAccounts.length) {
    try {
      const legacyAccount = JSON.parse(localStorage.getItem(STORAGE_KEYS.legacySingleAccount) || 'null');
      if (legacyAccount) {
        storedAccounts = [legacyAccount];
        localStorage.removeItem(STORAGE_KEYS.legacySingleAccount);
      }
    } catch (error) {
      storedAccounts = [];
    }
  }

  const accounts = storedAccounts.map(migrateAccountRecord);
  const needsRewrite = storedAccounts.some((record, index) => record !== accounts[index]);
  if (needsRewrite) writeAccounts(accounts);
  return accounts;
}

export const findAccount = (username) => getAccounts().find((account) => account.username === username);

export function saveAccount(account) {
  writeAccounts(getAccounts().filter((existing) => existing.username !== account.username).concat([account]));
}

export function replaceAccount(previousUsername, account) {
  writeAccounts(getAccounts().filter((existing) => existing.username !== previousUsername).concat([account]));
}

export function removeAccount(username) {
  writeAccounts(getAccounts().filter((account) => account.username !== username));
}

/* ---------- Session (sessionStorage, with an in-memory fallback) ---------- */

let sessionUsernameInMemory = null;

export function getSessionUsername() {
  try {
    return sessionStorage.getItem(STORAGE_KEYS.session);
  } catch (error) {
    return sessionUsernameInMemory;
  }
}

export function setSessionUsername(username) {
  sessionUsernameInMemory = username;
  try {
    if (username) sessionStorage.setItem(STORAGE_KEYS.session, username);
    else sessionStorage.removeItem(STORAGE_KEYS.session);
  } catch (error) {
    // Session storage unavailable: the in-memory copy is used instead.
  }
}

export function getCurrentAccount() {
  const username = getSessionUsername();
  return username ? findAccount(username) || null : null;
}

/* ---------- Password hashing ---------- */

const toHex = (bytes) => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

export const isPasswordHashingAvailable = () => Boolean(window.crypto && crypto.subtle);

export function createSalt() {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: ACCOUNT_RULES.passwordHashIterations, hash: 'SHA-256' },
    key,
    256,
  );
  return toHex(new Uint8Array(bits));
}

export async function passwordMatches(account, password) {
  return (await hashPassword(password, account.passwordSalt)) === account.passwordHash;
}

/* ---------- Login throttling ---------- */

let failedLoginAttempts = 0;
let loginLockedUntil = 0;

export const getLoginLockRemainingSeconds = () => Math.max(0, Math.ceil((loginLockedUntil - Date.now()) / 1000));

export function registerFailedLogin() {
  failedLoginAttempts += 1;
  if (failedLoginAttempts >= ACCOUNT_RULES.maximumLoginAttempts) {
    loginLockedUntil = Date.now() + ACCOUNT_RULES.loginLockMilliseconds;
    failedLoginAttempts = 0;
    return true;
  }
  return false;
}

export function resetFailedLogins() {
  failedLoginAttempts = 0;
}
