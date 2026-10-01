// Scriitor/cititor ZIP propriu, doar metoda STORE (necomprimat) — vezi
// docs/superpowers/plans/2026-10-01-backup-complet.md, decizia 1: zero dependențe npm noi,
// un fișier `.startica-backup` trebuie să rămână un ZIP valid (deschis cu orice utilitar,
// redenumit `.zip`), iar store elimină întreaga clasă de bug-uri de (de)compresie pentru
// un fișier a cărui singură treabă e să poată fi restaurat corect.
//
// Format PKZIP standard: local file header + date per fișier, apoi central directory, apoi
// end-of-central-directory. https://en.wikipedia.org/wiki/ZIP_(file_format)

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const VERSION = 20;

/** @typedef {{ name: string, data: Buffer }} ZipEntry */

let crcTable = null;
function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

/** @param {Buffer} buffer */
function crc32(buffer) {
  crcTable ??= buildCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) crc = crcTable[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Construiește o arhivă ZIP (store, fără compresie) din fișiere în memorie.
 * @param {ZipEntry[]} entries
 * @returns {Buffer}
 */
export function createZipArchive(entries) {
  const nameBuffers = entries.map(entry => Buffer.from(entry.name, 'utf8'));
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  entries.forEach((entry, index) => {
    const nameBuffer = nameBuffers[index];
    const crc = crc32(entry.data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE, 0);
    localHeader.writeUInt16LE(VERSION, 4);
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(0, 8); // metodă: 0 = store
    localHeader.writeUInt16LE(0, 10); // ora DOS
    localHeader.writeUInt16LE(0x21, 12); // data DOS (1 ianuarie 1980) — nesemnificativă pentru restaurare
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(entry.data.length, 18); // comprimat = necomprimat (store)
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field

    localChunks.push(localHeader, nameBuffer, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(CENTRAL_DIRECTORY_SIGNATURE, 0);
    centralHeader.writeUInt16LE(VERSION, 4); // version made by
    centralHeader.writeUInt16LE(VERSION, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(0, 10); // metodă
    centralHeader.writeUInt16LE(0, 12); // ora DOS
    centralHeader.writeUInt16LE(0x21, 14); // data DOS
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field
    centralHeader.writeUInt16LE(0, 32); // comment
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal attributes
    centralHeader.writeUInt32LE(0, 38); // external attributes
    centralHeader.writeUInt32LE(offset, 42); // offset-ul local header-ului

    centralChunks.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + entry.data.length;
  });

  const centralDirectorySize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const centralDirectoryOffset = offset;

  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0);
  endRecord.writeUInt16LE(0, 4); // disk number
  endRecord.writeUInt16LE(0, 6); // disk cu central directory
  endRecord.writeUInt16LE(entries.length, 8); // intrări pe acest disc
  endRecord.writeUInt16LE(entries.length, 10); // total intrări
  endRecord.writeUInt32LE(centralDirectorySize, 12);
  endRecord.writeUInt32LE(centralDirectoryOffset, 16);
  endRecord.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localChunks, ...centralChunks, endRecord]);
}

/**
 * Citește o arhivă ZIP (orice metodă de compresie STORE — celelalte metode nu sunt
 * suportate, pentru că `createZipArchive` nu le produce niciodată). Aruncă pe un buffer
 * care nu e un ZIP valid (fără end-of-central-directory găsit).
 * @param {Buffer} buffer
 * @returns {ZipEntry[]}
 */
export function readZipArchive(buffer) {
  // EOCD e ultimul record, fără comentariu (comment length 0 la tot ce scriem noi) — dar
  // căutăm de la coadă oricum, ca să tolerăm un comentariu pus de alt utilitar.
  let endOffset = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      endOffset = i;
      break;
    }
  }
  if (endOffset === -1) throw new Error('Fișier ZIP invalid: end-of-central-directory nu a fost găsit.');

  const totalEntries = buffer.readUInt16LE(endOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);

  /** @type {ZipEntry[]} */
  const entries = [];
  let cursor = centralDirectoryOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (buffer.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_SIGNATURE)
      throw new Error('Fișier ZIP invalid: central directory coruptă.');
    const method = buffer.readUInt16LE(cursor + 10);
    if (method !== 0) throw new Error(`Metodă de compresie ${method} nesuportată (doar store, 0).`);
    const crc = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const data = buffer.subarray(dataStart, dataStart + compressedSize);
    if (crc32(data) !== crc) throw new Error(`CRC invalid pentru „${name}” — arhiva e coruptă.`);

    entries.push({ name, data: Buffer.from(data) });
  }
  return entries;
}
