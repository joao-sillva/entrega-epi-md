import { DATABASE } from '../../config/constants.js';
import { EMBEDDED_CAEPI } from '../../../data/caepi-base.js';
import { openKeyValueStore } from '../../storage/browser-database.js';
import { formatUtcDate } from '../../utils/date.js';

/**
 * CAEPI database: maps an approval certificate number (CA) to the equipment
 * name, validity date and situation.
 *
 * The system ships with an embedded copy; the user may import a newer file
 * (zip, csv, txt or xlsx), which is then stored in the browser database.
 * Records are kept as `[name, validUntil, situation]` tuples to save memory,
 * since the registry has hundreds of thousands of entries.
 */
const caepiStore = openKeyValueStore(DATABASE.caepi);

const database = {
  records: null,
  recordCount: 0,
  /** Timestamp of the import, or of the embedded file's issue date. */
  referenceTimestamp: 0,
  isDefault: false,
};

const changeListeners = new Set();

/** Registers a function called after the database is replaced (import or restore). */
export function onCaepiDatabaseChanged(listener) {
  changeListeners.add(listener);
}

const notifyChanged = () => changeListeners.forEach((listener) => listener());

export const hasCaepiDatabase = () => Boolean(database.records);
export const isUsingDefaultCaepi = () => database.isDefault;
export const getCaepiReferenceTimestamp = () => database.referenceTimestamp;

/** @returns {{name: string, validUntil: string, situation: string} | null} */
export function findCaepiRecord(caNumber) {
  const tuple = database.records && database.records[caNumber];
  if (!tuple) return null;
  const [name, validUntil, situation] = tuple;
  return { name, validUntil, situation };
}

export function describeCaepiDatabase() {
  if (!database.records) return 'Nenhuma base disponível';
  const count = database.recordCount.toLocaleString('pt-BR');
  return database.isDefault
    ? `${count} CAs · base padrão do sistema (dados do Ministério do Trabalho de ${formatUtcDate(database.referenceTimestamp)})`
    : `${count} CAs · importada em ${new Date(database.referenceTimestamp).toLocaleDateString('pt-BR')}`;
}

/* ---------- Embedded database ---------- */

/** Decodes the gzip + Base64 payload into the lookup structure. */
async function decodeEmbeddedCaepi() {
  if (!window.DecompressionStream) return null;
  const compressedBytes = Uint8Array.from(atob(EMBEDDED_CAEPI.compressedBase64), (character) => character.charCodeAt(0));
  const decompressedStream = new Blob([compressedBytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const payload = JSON.parse(await new Response(decompressedStream).text());

  const records = {};
  let caNumber = 0;
  for (let position = 0; position < payload.r.length; position += 4) {
    caNumber += payload.r[position];
    records[caNumber] = [
      payload.n[payload.r[position + 1]],
      payload.d[payload.r[position + 2]],
      payload.s[payload.r[position + 3]],
    ];
  }
  return { records, recordCount: payload.r.length / 4, issuedOn: payload.em };
}

async function readImportedDatabase() {
  try {
    const stored = await caepiStore.read(DATABASE.caepi.recordKey);
    const records = stored && (stored.records || stored.out);
    if (!records) return false;
    database.records = records;
    database.recordCount = stored.recordCount || stored.n || Object.keys(records).length;
    database.referenceTimestamp = stored.importedAt || stored.at || 0;
    database.isDefault = false;
    return true;
  } catch (error) {
    return false;
  }
}

async function useEmbeddedDatabase() {
  try {
    const embedded = await decodeEmbeddedCaepi();
    if (!embedded) return;
    database.records = embedded.records;
    database.recordCount = embedded.recordCount;
    database.referenceTimestamp = Date.parse(embedded.issuedOn) || 0;
    database.isDefault = true;
  } catch (error) {
    // The system keeps working without CA lookup.
  }
}

/** Loads the imported database, or the embedded one when nothing was imported. */
export async function loadCaepiDatabase() {
  if (!(await readImportedDatabase())) await useEmbeddedDatabase();
  notifyChanged();
}

async function storeImportedDatabase(record) {
  try {
    await caepiStore.write(DATABASE.caepi.recordKey, record);
    return true;
  } catch (error) {
    return false;
  }
}

export async function restoreDefaultCaepiDatabase() {
  database.records = null;
  database.recordCount = 0;
  database.referenceTimestamp = 0;
  database.isDefault = false;
  await storeImportedDatabase({ recordCount: 0, records: null, importedAt: 0 });
  await loadCaepiDatabase();
  return database.isDefault;
}

/* ---------- Importing a file ---------- */

const IMPORT_ERROR = {
  columnsNotFound: 'columns-not-found',
  zipUnreadable: 'zip-unreadable',
  spreadsheetLibraryMissing: 'spreadsheet-library-missing',
  noRows: 'no-rows',
};

const CELL_DELIMITERS = [';', '|', '\t', ','];
const MAX_HEADER_ATTEMPTS = 10;
const CA_COLUMN_PATTERN = /registroca|numeroca|numerodoca|nrca|ncertificado/;
const NAME_COLUMN_NAMES = ['nomeequipamento', 'nomedoequipamento', 'equipamento', 'tipodeepi'];
/** Layout of the official file when it has no header row. */
const HEADERLESS_COLUMNS = { caIndex: 0, validityIndex: 1, situationIndex: 2, nameIndex: 7 };
const HEADERLESS_MINIMUM_COLUMNS = 8;

/** Reads CAEPI rows one line at a time, discovering the columns from the header. */
function createRowParser() {
  const records = {};
  let delimiter = '';
  let columns = null;
  let headerAttempts = 0;
  let firstLine = '';
  let acceptedRowCount = 0;

  const splitLine = (line) => line.split(delimiter).map((cell) => cell.replace(/^"|"$/g, '').trim());

  function detectColumns(line) {
    if (!firstLine) firstLine = line;
    delimiter = CELL_DELIMITERS.slice()
      .sort((a, b) => line.split(b).length - line.split(a).length)[0];
    const cells = splitLine(line);
    const headers = cells.map((cell) => cell.toLowerCase().replace(/[^a-z]/g, ''));
    const caIndex = headers.findIndex((header) => header === 'ca' || CA_COLUMN_PATTERN.test(header));
    const nameIndex = headers.findIndex((header) => NAME_COLUMN_NAMES.includes(header));

    if (caIndex >= 0 && nameIndex >= 0) {
      columns = {
        caIndex,
        nameIndex,
        validityIndex: headers.findIndex((header) => /^data(de)?validade|^validade/.test(header)),
        situationIndex: headers.findIndex((header) => header === 'situacao'),
      };
      return;
    }
    const looksLikeDataRow = headerAttempts === 0 && /^\d+$/.test(cells[0] || '') && cells.length >= HEADERLESS_MINIMUM_COLUMNS;
    if (looksLikeDataRow) {
      columns = { ...HEADERLESS_COLUMNS };
      return;
    }
    headerAttempts += 1;
    if (headerAttempts > MAX_HEADER_ATTEMPTS) throw new Error(IMPORT_ERROR.columnsNotFound);
  }

  function parseLine(line) {
    if (!line.trim()) return;
    if (!columns) {
      detectColumns(line);
      if (!columns) return;
    }
    const cells = splitLine(line);
    const caNumber = (cells[columns.caIndex] || '').replace(/\D/g, '');
    const name = cells[columns.nameIndex];
    if (!caNumber || !name) return;
    records[caNumber] = [
      name,
      columns.validityIndex >= 0 ? cells[columns.validityIndex] : '',
      columns.situationIndex >= 0 ? cells[columns.situationIndex] : '',
    ];
    acceptedRowCount += 1;
  }

  return {
    parseLine,
    records,
    getAcceptedRowCount: () => acceptedRowCount,
    hasColumns: () => Boolean(columns),
    getFirstLine: () => firstLine,
  };
}

/* ---------- Zip reading (only the first text entry is needed) ---------- */

const ZIP_SIGNATURE = { endOfCentralDirectory: 0x06054b50, centralDirectoryEntry: 0x02014b50 };
const ZIP_COMPRESSION = { stored: 0, deflate: 8 };
const ZIP_TAIL_SEARCH_BYTES = 70000;
const ZIP64_PLACEHOLDER = 0xFFFFFFFF;

async function findZipEntry(file) {
  const tail = new DataView(await file.slice(Math.max(0, file.size - ZIP_TAIL_SEARCH_BYTES)).arrayBuffer());
  let endRecordPosition = -1;
  for (let position = tail.byteLength - 22; position >= 0; position -= 1) {
    if (tail.getUint32(position, true) === ZIP_SIGNATURE.endOfCentralDirectory) {
      endRecordPosition = position;
      break;
    }
  }
  if (endRecordPosition < 0) throw new Error(IMPORT_ERROR.zipUnreadable);

  const entryCount = tail.getUint16(endRecordPosition + 10, true);
  const directorySize = tail.getUint32(endRecordPosition + 12, true);
  const directoryOffset = tail.getUint32(endRecordPosition + 16, true);
  const directory = new DataView(await file.slice(directoryOffset, directoryOffset + directorySize).arrayBuffer());

  let offset = 0;
  let chosenEntry = null;
  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (directory.getUint32(offset, true) !== ZIP_SIGNATURE.centralDirectoryEntry) break;
    const nameLength = directory.getUint16(offset + 28, true);
    const extraLength = directory.getUint16(offset + 30, true);
    const commentLength = directory.getUint16(offset + 32, true);
    const name = new TextDecoder().decode(new Uint8Array(directory.buffer, directory.byteOffset + offset + 46, nameLength));
    const entry = {
      compressionMethod: directory.getUint16(offset + 10, true),
      compressedSize: directory.getUint32(offset + 20, true),
      localHeaderOffset: directory.getUint32(offset + 42, true),
      isTextFile: /\.(txt|csv)$/i.test(name),
    };
    if (entry.isTextFile && !(chosenEntry && chosenEntry.isTextFile)) chosenEntry = entry;
    else if (!chosenEntry) chosenEntry = entry;
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (!chosenEntry || chosenEntry.compressedSize === ZIP64_PLACEHOLDER) throw new Error(IMPORT_ERROR.zipUnreadable);
  return chosenEntry;
}

/** Returns a stream reader over the file, or over the text entry inside a zip. */
async function openCaepiStreamReader(file) {
  if (!/\.zip$/i.test(file.name)) return file.stream().getReader();

  const entry = await findZipEntry(file);
  const localHeader = new DataView(await file.slice(entry.localHeaderOffset, entry.localHeaderOffset + 30).arrayBuffer());
  const dataStart = entry.localHeaderOffset + 30 + localHeader.getUint16(26, true) + localHeader.getUint16(28, true);
  const entryData = file.slice(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === ZIP_COMPRESSION.stored) return entryData.stream().getReader();
  if (entry.compressionMethod === ZIP_COMPRESSION.deflate && window.DecompressionStream) {
    return entryData.stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  }
  throw new Error(IMPORT_ERROR.zipUnreadable);
}

function createTextDecoderFor(firstChunk) {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(firstChunk, { stream: true });
    return new TextDecoder('utf-8');
  } catch (error) {
    return new TextDecoder('windows-1252');
  }
}

async function readSpreadsheetLines(file, parseLine) {
  if (!window.XLSX) throw new Error(IMPORT_ERROR.spreadsheetLibraryMissing);
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]], { FS: ';' })
    .split(/\r?\n/)
    .forEach(parseLine);
}

async function readTextLines(file, parser, reportProgress) {
  const reader = await openCaepiStreamReader(file);
  let decoder = null;
  let incompleteLine = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!decoder) decoder = createTextDecoderFor(value);
    const lines = (incompleteLine + decoder.decode(value, { stream: true })).split(/\r?\n/);
    incompleteLine = lines.pop();
    lines.forEach(parser.parseLine);
    reportProgress(parser.getAcceptedRowCount());
  }
  if (incompleteLine) parser.parseLine(incompleteLine);
}

/**
 * Imports a CAEPI file and makes it the active database.
 * Resolves with `{ rowCount, recordCount, savedInBrowser }`; rejects with an
 * Error whose `code` and `firstLine` explain what went wrong.
 */
export async function importCaepiFile(file, reportProgress) {
  const parser = createRowParser();
  try {
    if (/\.xlsx?$/i.test(file.name)) await readSpreadsheetLines(file, parser.parseLine);
    else await readTextLines(file, parser, reportProgress);
    if (!parser.getAcceptedRowCount()) {
      throw new Error(parser.hasColumns() ? IMPORT_ERROR.noRows : IMPORT_ERROR.columnsNotFound);
    }
  } catch (error) {
    error.firstLine = parser.getFirstLine();
    throw error;
  }

  database.records = parser.records;
  database.isDefault = false;
  database.recordCount = Object.keys(parser.records).length;
  database.referenceTimestamp = Date.now();
  const savedInBrowser = await storeImportedDatabase({
    recordCount: database.recordCount,
    records: parser.records,
    importedAt: database.referenceTimestamp,
  });
  notifyChanged();
  return { rowCount: parser.getAcceptedRowCount(), recordCount: database.recordCount, savedInBrowser };
}

export const CAEPI_IMPORT_ERROR = IMPORT_ERROR;
