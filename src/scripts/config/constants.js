/** Application-wide constants. Nothing in this file has side effects. */

/** Maximum number of PPE lines that fit in one printed sheet (FORM. 87/3). */
export const MAX_ITEMS_PER_SHEET = 13;

export const EMPLOYEES_PER_PAGE = 9;

/** Design width (px) of the printed sheet, used to scale it down on small screens. */
export const SHEET_DESIGN_WIDTH = 720;

export const SCHEMA_VERSION = 2;
export const BACKUP_APP_NAME = 'entrega-epi';

export const STORAGE_KEYS = {
  accounts: 'epi-accs',
  legacySingleAccount: 'epi-acc',
  session: 'epi-sess',
  accountDataPrefix: 'epi-md:',
  legacySingleAccountData: 'epi-md',
};

export const DATABASE = {
  accountData: { name: 'epi-data', storeName: 'd' },
  caepi: { name: 'epi-caepi', storeName: 'b', recordKey: 'map' },
};

export const ACCOUNT_RULES = {
  minimumFullNameLength: 3,
  minimumPasswordLength: 6,
  usernamePattern: /^[a-z0-9._-]{3,}$/,
  passwordHashIterations: 150000,
  maximumLoginAttempts: 5,
  loginLockMilliseconds: 30000,
};

export const PHOTO_RULES = {
  maximumWidth: 560,
  jpegQuality: 0.72,
};

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Words that stay lowercase when capitalizing a person's name. */
export const NAME_CONNECTORS = ['da', 'de', 'do', 'das', 'dos', 'e'];

/** Background / text color pairs used for employee avatars. */
export const AVATAR_COLORS = [
  ['#fbe9e9', '#ac1a24'],
  ['#f6ece4', '#8a5a36'],
  ['#f0ebe8', '#5f4b43'],
  ['#fdf0dc', '#a8620a'],
  ['#f7e4e2', '#8a1019'],
  ['#eef0ea', '#4e5d3f'],
];

/** Fill codes printed on the sheet. */
export const FILL_CODE = {
  firstDelivery: '01',
  normalWearReplacement: '02',
  lossReplacement: '03',
  abnormalWearReplacement: '04',
  other: '05',
};

export const FILE_MIME_TYPES = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
  json: 'application/json',
};

/** Roles that must sign a sheet, in the order the signatures are collected. */
export const SIGNER_ROLE = {
  technician: 'technician',
  employee: 'employee',
};

export const SIGNER_ROLE_LABEL = {
  technician: 'técnico',
  employee: 'funcionário',
};
