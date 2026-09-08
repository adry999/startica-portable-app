import { normalizeRecord, dateOK } from '../shared/domain.mjs';

const clean = value => String(value ?? '').trim();
const key = value =>
  clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const contractKey = value =>
  clean(value)
    .toUpperCase()
    .replace(/^(?:CSV-|ID-)/, '')
    .replace(/^0+(?=\d)/, '');
const headers = {
  contract: ['ID (Nr. contract)', 'Nr. contract'],
  name: ['Nume/prenume copil:', 'Nume copil'],
  parent: ['Parinte', 'Părinte', 'Parinte 1'],
  phone: ['Nr.de contact', 'Telefon', 'Telefon 1'],
  parent2: ['Parinte 2'],
  phone2: ['Telefon 2'],
  birthDate: ['Data nasterii'],
  contractDate: ['Data contract'],
  attendanceDate: ['Data frecventarii'],
  contractLabel: ['Nume parinte / Nr. contract'],
  drafted: ['Data intocmirii'],
  age: ['Varsta'],
};

// Strict CSV parsing for the application (not an Excel conversion). Keep phones
// and contract numbers as text; support quoted delimiters/newlines and UTF-8 BOM.
export function csvRows(text) {
  if (typeof text !== 'string' || !text.trim()) throw Error('CSV gol.');
  if (text.length > 2000000) throw Error('CSV prea mare (maximum 2 MB).');
  if (text.includes('\uFFFD') || text.includes('\0')) throw Error('Salvează fișierul ca CSV UTF-8.');
  text = text.replace(/^\uFEFF/, '');
  if (/^sep=[;,\t]\r?\n/i.test(text)) text = text.slice(text.indexOf('\n') + 1);
  const first = text.split(/\r?\n/, 1)[0];
  const delimiter = [',', ';', '\t'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows = [];
  let row = [],
    cell = '',
    quoted = false,
    closed = false,
    line = 1,
    startLine = 1;
  const field = () => {
    row.push(cell);
    cell = '';
    closed = false;
  };
  const finish = () => {
    field();
    if (row.some(v => v.trim())) rows.push({ line: startLine, cells: row });
    row = [];
    if (rows.length > 2001) throw Error('Maximum 2000 copii per import.');
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        cell += c;
        if (c === '\n') line++;
      }
      continue;
    }
    if (c === delimiter) {
      field();
      continue;
    }
    if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      finish();
      line++;
      startLine = line;
      continue;
    }
    if (closed) {
      if (c === ' ' || c === '\t') continue;
      throw Error(`Rând ${line}: text după ghilimeaua de închidere.`);
    }
    if (c === '"') {
      if (cell.trim()) throw Error(`Rând ${line}: ghilimele incorecte.`);
      cell = '';
      quoted = true;
    } else cell += c;
    if (cell.length > 10000) throw Error(`Rând ${line}: câmp prea lung.`);
  }
  if (quoted) throw Error(`Rând ${startLine}: ghilimele neînchise.`);
  finish();
  return rows;
}

function csvDate(value, label, line) {
  value = clean(value);
  if (!value || value === '.') return '';
  const m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(value);
  const result = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : value;
  let valid = false;
  try {
    valid = dateOK(result);
  } catch {}
  if (!valid) throw Error(`Rând ${line}: ${label} invalidă (${value}). Folosește ZZ.LL.AAAA.`);
  return result;
}

export function previewChildrenCSV(text, existing = []) {
  const result = { total: 0, additions: [], rows: [], errors: [], warnings: [], skipped: 0, conflicts: 0 };
  let source;
  try {
    source = csvRows(text);
  } catch (e) {
    result.errors.push(e.message);
    return result;
  }
  const header = source.shift()?.cells || [],
    indices = {};
  for (const [field, aliases] of Object.entries(headers)) {
    const found = header.map((h, i) => (aliases.map(key).includes(key(h)) ? i : -1)).filter(i => i >= 0);
    if (found.length > 1) result.errors.push(`Coloană repetată: ${aliases[0]}.`);
    indices[field] = found[0] ?? -1;
  }
  for (const field of ['contract', 'name'])
    if (indices[field] < 0) result.errors.push(`Lipsește coloana ${headers[field][0]}.`);
  const known = new Set(Object.values(headers).flat().map(key));
  const unknown = header.filter(h => clean(h) && !known.has(key(h)));
  if (unknown.length) result.warnings.push('Coloane neimportate: ' + unknown.join(', ') + '.');
  if (!source.length) result.errors.push('Fișierul nu conține copii.');
  if (result.errors.length) return result;
  result.total = source.length;
  result.warnings.push(
    'Taxa și grupa rămân necompletate. Statutul este „De verificat”; lista nu confirmă situația actuală. Vârsta se calculează din data nașterii, nu se importă ca valoare fixă.',
  );
  const contracts = new Set(),
    identities = new Set(),
    candidates = [];
  for (const { line, cells } of source) {
    const get = field => clean(cells[indices[field]]),
      warnings = [];
    try {
      if (cells.length !== header.length) throw Error(`Rând ${line}: numărul coloanelor diferă de antet.`);
      const contractNumber = get('contract'),
        name = get('name');
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(contractNumber))
        throw Error(`Rând ${line}: număr de contract lipsă sau invalid.`);
      if (!name) throw Error(`Rând ${line}: numele copilului lipsește.`);
      const contract = contractKey(contractNumber);
      if (contracts.has(contract)) throw Error(`Rând ${line}: contract repetat (${contractNumber}).`);
      contracts.add(contract);
      const birthDate = csvDate(get('birthDate'), 'data nașterii', line),
        contractDate = csvDate(get('contractDate'), 'data contractului', line),
        attendanceDate = csvDate(get('attendanceDate'), 'data frecventării', line);
      if (birthDate && ((attendanceDate && birthDate > attendanceDate) || (contractDate && birthDate > contractDate)))
        warnings.push(
          'Date neconcordante: nașterea este după contract/frecventare. Valorile sursei au fost păstrate; verifică documentele.',
        );
      for (const f of ['birthDate', 'contractDate', 'attendanceDate'])
        if (get(f) === '.') warnings.push(`${headers[f][0]}: sursa conține „.”; câmpul rămâne gol.`);
      const identity = key(name) + '|' + birthDate;
      if (identities.has(identity))
        throw Error(`Rând ${line}: același nume și aceeași dată de naștere apar de două ori.`);
      identities.add(identity);
      if (!birthDate) warnings.push('Data nașterii lipsește.');
      if (!attendanceDate) warnings.push('Data frecventării lipsește.');
      if (!get('phone')) warnings.push('Telefon lipsă.');
      if (!get('parent')) warnings.push('Părinte lipsă.');
      if (get('parent') && key(get('parent')) === key(name))
        warnings.push('Câmpul Părinte coincide cu numele copilului; verifică rubrica din contract.');
      const notes = [
        'Import copii CSV; contract nr. ' + contractNumber,
        get('contractLabel') ? 'Rubrica părinte / contract din sursă: ' + get('contractLabel') : '',
        get('drafted') ? 'Data întocmirii din sursă: ' + get('drafted') : '',
        ...warnings,
      ]
        .filter(Boolean)
        .join('\n');
      const record = normalizeRecord('children', {
        id: 'CSV-' + contractNumber,
        contractNumber,
        name,
        parent: get('parent'),
        phone: get('phone'),
        parent2: get('parent2'),
        phone2: get('phone2'),
        birthDate,
        contractDate,
        attendanceDate,
        status: 'De verificat',
        group: '',
        fee: null,
        feeHistory: [],
        statusHistory: [],
        notes,
      });
      candidates.push({ line, record, warnings });
    } catch (e) {
      result.errors.push(e.message);
    }
  }
  for (const item of candidates) {
    const r = item.record;
    const matches = existing.filter(
      c => contractKey(c.contractNumber || c.id) === contractKey(r.contractNumber) || key(c.name) === key(r.name),
    );
    let action = 'add',
      reason = 'Copil nou';
    if (matches.length) {
      const exact =
        matches.length === 1 &&
        key(matches[0].name) === key(r.name) &&
        (!matches[0].birthDate || !r.birthDate || matches[0].birthDate === r.birthDate);
      action = exact ? 'skip' : 'conflict';
      reason = exact
        ? 'Există deja; datele existente rămân neschimbate.'
        : 'Posibil duplicat / contract în conflict; nu se importă automat.';
      if (exact) result.skipped++;
      else result.conflicts++;
      item.warnings.push('Înregistrări existente: ' + matches.map(c => c.id).join(', '));
      if (
        exact &&
        ['parent', 'phone', 'parent2', 'phone2', 'birthDate', 'contractDate', 'attendanceDate'].some(
          f => clean(matches[0][f]) !== clean(r[f]),
        )
      )
        item.warnings.push('CSV-ul are câmpuri diferite; verifică manual fișa existentă.');
    } else result.additions.push(r);
    result.rows.push({
      line: item.line,
      id: r.id,
      name: r.name,
      contractNumber: r.contractNumber,
      parent: r.parent,
      phone: r.phone,
      parent2: r.parent2,
      phone2: r.phone2,
      birthDate: r.birthDate,
      attendanceDate: r.attendanceDate,
      action,
      reason,
      warnings: item.warnings,
    });
  }
  return result;
}
