import { emptyState, normalizeRecord, CHILD_STATUSES, TYPES } from '#shared/domain/record-schema.mjs';
import { today } from '#shared/domain/calendar-month.mjs';
import { allocations, paymentTenders } from '#shared/domain/payment-allocations.mjs';
import { buildImportReport } from './import-report.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').RecordsSnapshot} RecordsSnapshot */
/** @typedef {import('./import-report.mjs').FindRecordIssues} FindRecordIssues */
/** @typedef {import('../data-transfer.types.mjs').ImportReport} ImportReport */

// Coloana de statut din V5 este text liber. Orice valoare pe care aplicația nu
// o poate interpreta devine „De verificat”, cu textul original păstrat în
// observații, ca importul să nu piardă rândul și nici informația din sursă.
/** @param {unknown} value */
export function mapV5ChildStatus(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { status: 'Activ', note: '' };
  const match = CHILD_STATUSES.find(status => status.toLocaleLowerCase('ro-RO') === raw.toLocaleLowerCase('ro-RO'));
  return match ? { status: match, note: '' } : { status: 'De verificat', note: `Statut din sursă: ${raw}` };
}

/**
 * @param {unknown} value
 * @param {any} XLSX
 */
function excelDate(value, XLSX) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}` : '';
  }
  if (value instanceof Date)
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  const text = String(value).trim();
  const ro = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return ro
    ? `${ro[3]}-${ro[2].padStart(2, '0')}-${ro[1].padStart(2, '0')}`
    : /^\d{4}-\d{2}-\d{2}$/.test(text)
      ? text
      : '';
}

/**
 * @param {any} workbook
 * @param {any} XLSX
 * @param {FindRecordIssues} findRecordIssues
 * @returns {ImportReport}
 */
export function readWorkbook(workbook, XLSX, findRecordIssues) {
  const state = emptyState(),
    errors = [],
    warnings = [];
  const rows = name => XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: null });
  if (workbook.Sheets.Startica_Format) {
    if (rows('Startica_Format')[0]?.[0] !== 'STARTICA_EXPORT_2' || !workbook.Sheets.Startica_Date)
      return { errors: ['Format Startica necunoscut.'], warnings: [] };
    const chunks = new Map();
    for (const [type, id, part, json] of rows('Startica_Date').slice(1)) {
      if (
        !Object.hasOwn(state, type) ||
        typeof id !== 'string' ||
        !Number.isInteger(part) ||
        part < 0 ||
        typeof json !== 'string'
      ) {
        errors.push('Rând invalid în datele complete.');
        continue;
      }
      const key = JSON.stringify([type, id]);
      if (!chunks.has(key)) chunks.set(key, []);
      if (chunks.get(key)[part] !== undefined) errors.push(`Fragment repetat: ${id}`);
      chunks.get(key)[part] = json;
    }
    for (const [key, parts] of chunks) {
      const [type, id] = JSON.parse(key);
      try {
        for (let n = 0; n < parts.length; n++) if (typeof parts[n] !== 'string') throw Error('fragment lipsă');
        const record = JSON.parse(parts.join(''));
        if (record.id !== id) throw Error('ID diferit');
        state[type].push(record);
      } catch (e) {
        errors.push(`${id}: ${/** @type {Error} */ (e).message}`);
      }
    }
  } else {
    for (const name of ['Copii', 'Achitari', 'Cheltuieli'])
      if (!workbook.Sheets[name]) errors.push(`Lipsește fila ${name}.`);
    if (errors.length) return { errors, warnings };
    // V5 începe datele pe rândul 5. Un export nativ/necunoscut nu trebuie interpretat greșit ca V5.
    if (
      !String(rows('Copii')[3]?.[0] || '')
        .toLowerCase()
        .includes('id') ||
      !String(rows('Achitari')[3]?.[0] || '')
        .toLowerCase()
        .includes('id')
    )
      return {
        errors: ['Structura nu este V5. Folosește V5 original sau un export complet din această versiune.'],
        warnings,
      };
    const parse = (name, type, fn, belongs) =>
      rows(name)
        .slice(4)
        .forEach((row, i) => {
          if (!belongs(row)) return;
          try {
            state[type].push(normalizeRecord(type, fn(row, i)));
          } catch (e) {
            errors.push(`${name}, rândul ${i + 5}: ${/** @type {Error} */ (e).message}`);
          }
        });
    const t = v => String(v ?? '').trim(),
      d = v => excelDate(v, XLSX);
    // Coloana de grupă din V5 este text liber; devine o entitate proprie, ca la
    // migrarea din baza existentă — un nume nou întâlnit primește o grupă nouă.
    const groupNameToId = new Map();
    for (const row of rows('Copii').slice(4)) {
      const name = t(row?.[7]);
      if (name && !groupNameToId.has(name)) {
        const id = `GRP-${crypto.randomUUID()}`;
        groupNameToId.set(name, id);
        state.groups.push({ id, name, capacity: null });
      }
    }
    parse(
      'Copii',
      'children',
      r => {
        const { status, note } = mapV5ChildStatus(r[10]);
        return {
          id: t(r[0]),
          name: t(r[1]),
          parent: t(r[2]),
          phone: t(r[3]),
          birthDate: d(r[4]),
          contractDate: d(r[5]),
          attendanceDate: d(r[6]),
          groupId: t(r[7]) ? groupNameToId.get(t(r[7])) : null,
          fee: Number(r[8]) > 0 ? Number(r[8]) : null,
          dueDay: r[9] ? Number(r[9]) : 10,
          status,
          withdrawalDate: d(r[11]),
          notes: [t(r[12]), note].filter(Boolean).join('\n'),
          verification: t(r[13]),
          feeHistory: [],
          statusHistory: [],
        };
      },
      r => !!r[0] && !String(r[0]).toUpperCase().includes('TOTAL'),
    );
    parse(
      'Achitari',
      'payments',
      r => ({
        id: t(r[0]),
        date: d(r[1]),
        childId: t(r[2]),
        childName: t(r[3]),
        sourceName: t(r[4]),
        group: t(r[5]),
        month: d(r[6]).slice(0, 7),
        method: t(r[7]) || 'Cash',
        amount: Number(r[8]),
        type: t(r[9]),
        notes: t(r[10]),
        verification: t(r[11]),
        original: t(r[12]),
      }),
      r => !!r[0] && !String(r[0]).toUpperCase().includes('TOTAL'),
    );
    parse(
      'Cheltuieli',
      'expenses',
      (r, i) => ({
        id: `EXP-${String(i + 1).padStart(4, '0')}`,
        date: d(r[6]),
        category: t(r[7]) || 'Altele',
        description: '',
        amount: Number(r[8]),
      }),
      r => r[6] != null && r[6] !== '' && !String(r[6]).toUpperCase().includes('TOTAL') && r[8] != null && r[8] !== '',
    );
    warnings.push({
      reason: 'V5: taxa nu are dată de aplicare. Completează istoricul taxei înainte de a folosi restanțele.',
    });
    const childIds = new Set(state.children.map(c => c.id));
    for (const p of state.payments) {
      if (p.childId && !childIds.has(p.childId)) {
        p.sourceChildId = p.childId;
        p.childId = '';
        warnings.push({ reason: `${p.id}: ID copil necunoscut ${p.sourceChildId}; plata rămâne de asociat.` });
      }
      if (/multi|mai multe|multe luni/i.test(p.verification)) {
        p.allocations = [];
        p.month = '';
      }
    }
  }
  const report = buildImportReport(state, findRecordIssues);
  return { ...report, errors: [...errors, ...report.errors], warnings: [...warnings, ...report.warnings] };
}

/**
 * @param {RecordsSnapshot} records
 * @param {any} XLSX
 */
export function exportWorkbook(records, XLSX) {
  const wb = XLSX.utils.book_new(),
    sheet = (name, data) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), name);
  const groupName = id => records.groups.find(g => g.id === id)?.name || '';
  sheet(
    'Copii',
    records.children.map(child => ({
      ID: child.id,
      Nume: child.name,
      Parinte: child.parent,
      Telefon: child.phone,
      Parinte_2: child.parent2 || '',
      Telefon_2: child.phone2 || '',
      Nr_contract: child.contractNumber || '',
      Grupa: groupName(child.groupId),
      Statut: child.status,
      Arhivat: !!child.archived,
      Taxa: child.fee,
      Scadenta: child.dueDay,
      Inceput: child.attendanceDate,
      Retragere: child.withdrawalDate,
      Observatii: child.notes,
    })),
  );
  sheet(
    'Achitari',
    records.payments.map(payment => ({
      ID: payment.id,
      Data: payment.date,
      ID_copil: payment.childId,
      Copil:
        records.children.find(c => c.id === payment.childId)?.name || payment.childName || payment.sourceName || '',
      Metoda: payment.method,
      Suma: payment.amount,
      Cash: paymentTenders(payment)
        .filter(p => p.method === 'Cash')
        .reduce((n, p) => n + p.amount, 0),
      Card: paymentTenders(payment)
        .filter(p => p.method === 'Card')
        .reduce((n, p) => n + p.amount, 0),
      Transfer: paymentTenders(payment)
        .filter(p => p.method === 'Transfer')
        .reduce((n, p) => n + p.amount, 0),
      Detalii_metode: paymentTenders(payment)
        .map(p => `${p.method}: ${p.amount}`)
        .join('; '),
      Repartizari: allocations(payment)
        .map(a => `${a.month}: ${a.amount}`)
        .join('; '),
      Arhivat: !!payment.archived,
      Observatii: payment.notes,
    })),
  );
  sheet(
    'Cheltuieli',
    records.expenses.map(expense => ({
      ID: expense.id,
      Data: expense.date,
      Categorie: expense.category,
      Descriere: expense.description,
      Suma: expense.amount,
      Arhivat: !!expense.archived,
    })),
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['STARTICA_EXPORT_2'],
      ['Creat', today()],
      ['Reimportul folosește fila Startica_Date, care păstrează toate câmpurile.'],
    ]),
    'Startica_Format',
  );
  const raw = [['Tip', 'ID', 'Fragment', 'Date complete']];
  for (const type of TYPES)
    for (const r of records[type]) {
      const json = JSON.stringify(r);
      for (let i = 0; i < json.length; i += 16000) raw.push([type, r.id, i / 16000, json.slice(i, i + 16000)]);
    }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(raw), 'Startica_Date');
  return wb;
}
