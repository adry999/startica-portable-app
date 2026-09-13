import { existsSync, statSync } from 'node:fs';
import { resolve, isAbsolute, relative } from 'node:path';
import { validateState, normalizeRecord, applyChildSetup, summary, importReport } from '../shared/domain.mjs';
import { previewChildrenCSV } from './children-csv.mjs';
import { financialImportPlan } from './financial-import.mjs';
import { snapshotState } from './backups.mjs';
import { fail } from './util.mjs';
import { sendResponse } from '#core/server/http/json-response.mjs';
import { RESPONSE_SENT, createRouteDispatcher } from '#core/server/http/route-dispatcher.mjs';
import { createAuditLogRoutes } from '#features/audit-log/index.server.mjs';

// Folderul extern nu are voie să fie baza activă sau folderul de backupuri:
// altfel copiile s-ar suprascrie sau ar fi șterse de retenție.
function checkExternalDir(folder, reserved) {
  if (!folder) return;
  if (!isAbsolute(folder) || !existsSync(folder) || !statSync(folder).isDirectory())
    fail('Alege un folder existent, folosind calea completă.');
  const absolute = resolve(folder);
  for (const dir of reserved) {
    const inside = relative(resolve(dir), absolute);
    if (absolute === resolve(dir) || (!inside.startsWith('..') && !isAbsolute(inside)))
      fail('Alege un folder diferit de baza de date și backupurile locale.');
  }
}

export function createRouter(context) {
  const { root, token, dataDir, backupDir, allowShutdown, settings, backups, store, shutdown } = context;
  const { setting, setSetting } = settings;

  const read = {
    '/api/session': () => ({ token }),
    '/api/state': () => store.envelope(),
    '/api/health': () => backups.health(),
    '/api/backups': () => backups.list(),
    '/api/backup-preview': url => {
      const s = snapshotState(backups.selectedBackup(url.searchParams.get('name')));
      return { ...summary(s), errors: importReport(s).errors };
    },
  };

  const write = {
    '/api/shutdown': (b, url, res) => {
      if (!allowShutdown) fail('Operațiune inexistentă.', 404);
      backups.cancelScheduledBackup();
      const result = backups.safeBackup('inchidere');
      sendResponse(res, { ok: true, warning: result.warning || '' });
      shutdown();
      return RESPONSE_SENT;
    },

    '/api/record': b =>
      store.commit(b, 'salvare', () => {
        const r = normalizeRecord(b.type, b.record),
          old = store.readRecord(b.type, r.id);
        if (!['create', 'update'].includes(b.mode)) fail('Mod de salvare invalid.');
        if (b.mode === 'create' && old) fail('ID deja folosit.', 409);
        if (b.mode === 'update' && !old) fail('Înregistrarea nu mai există.', 409);
        if (b.type === 'payments' && r.childId && !store.recordExists('children', r.childId))
          fail('Copilul asociat nu există.');
        if (b.type === 'children' && r.groupId && !store.recordExists('groups', r.groupId))
          fail('Grupa asociată nu există.');
        if (b.type === 'groups') {
          const clash = store
            .readState()
            .groups.some(g => g.id !== r.id && g.name.toLocaleLowerCase('ro-RO') === r.name.toLocaleLowerCase('ro-RO'));
          if (clash) fail('Există deja o grupă cu acest nume.');
        }
        if (b.type === 'categories') {
          const clash = store
            .readState()
            .categories.some(
              g => g.id !== r.id && g.name.toLocaleLowerCase('ro-RO') === r.name.toLocaleLowerCase('ro-RO'),
            );
          if (clash) fail('Există deja o categorie cu acest nume.');
        }
        store.writeRecord(b.type, r);
        store.audit(old ? 'modificare' : 'adăugare', b.type, r.id, old, r);
      }),

    // Grupele nu se arhivează, se șterg direct — dar numai când nimeni nu mai
    // e atribuit ei, altfel copiii ar rămâne cu o referință către nimic.
    '/api/group-delete': b =>
      store.commit(b, 'ștergere grupă', () => {
        const g = store.readRecord('groups', b.id);
        if (!g) fail('Grupa nu mai există.', 409);
        const children = store.readState().children.filter(c => c.groupId === b.id);
        if (children.length) {
          const archived = children.filter(c => c.archived).length;
          fail(
            archived
              ? 'Mută mai întâi copiii din grupă, inclusiv copiii arhivați. Ei păstrează grupa pentru restaurare.'
              : 'Mută mai întâi copiii din grupă.',
          );
        }
        store.deleteRecord('groups', b.id);
        store.audit('ștergere', 'groups', b.id, g, null);
      }),

    // Categoria e doar o etichetă text pentru cheltuieli (fără FK), deci
    // ștergerea nu are nevoie de verificare de ocupare, ca la grupe.
    '/api/category-delete': b =>
      store.commit(b, 'ștergere categorie', () => {
        const c = store.readRecord('categories', b.id);
        if (!c) fail('Categoria nu mai există.', 409);
        store.deleteRecord('categories', b.id);
        store.audit('ștergere', 'categories', b.id, c, null);
      }),

    // Ștergere definitivă, doar pentru ce e deja arhivat — arhivarea rămâne
    // singura cale reversibilă; asta e ireversibilă, de-aia backup înainte.
    '/api/record-delete': b =>
      store.commit(
        b,
        'ștergere definitivă',
        () => {
          if (!['children', 'payments', 'expenses'].includes(b.type)) fail('Tip invalid.');
          const r = store.readRecord(b.type, b.id);
          if (!r) fail('Înregistrarea nu mai există.', 409);
          if (!r.archived) fail('Doar înregistrările arhivate pot fi șterse definitiv.');
          if (b.type === 'children' && store.readState().payments.some(p => p.childId === b.id))
            fail('Șterge mai întâi achitările copilului, altfel ar rămâne fără copil valid.');
          store.deleteRecord(b.type, b.id);
          store.audit('ștergere definitivă', b.type, b.id, r, null);
        },
        true,
      ),

    // Completarea în masă a taxei, grupei și statutului. Fără ea, cei 105 copii
    // importați din CSV nu pot fi evaluați deloc, iar lista de notificat rămâne
    // goală fără ca nimic să fie greșit.
    '/api/children-setup': b => {
      if (!Array.isArray(b.updates) || !b.updates.length || b.updates.length > 5000)
        fail('Lista de completări este invalidă.');
      return store.commit(
        b,
        'completare-taxe',
        () => {
          const seen = new Set();
          for (const update of b.updates) {
            if (seen.has(update?.id)) fail(`Fișa ${update.id} apare de două ori.`);
            seen.add(update?.id);
            const old = store.readRecord('children', update?.id);
            if (!old) fail(`Fișa ${update?.id} nu mai există. Reîncarcă datele.`, 409);
            if (update.groupId && !store.recordExists('groups', update.groupId)) fail('Grupa asociată nu există.');
            const r = applyChildSetup(old, update);
            store.writeRecord('children', r);
            store.audit('completare taxe și grupe', 'children', r.id, old, r);
          }
        },
        true,
      );
    },

    // Asocierea în masă a achitărilor rămase fără copil. Doar cele neasociate
    // pot fi legate: o achitare deja atribuită nu se schimbă din greșeală aici.
    '/api/payments-assign': b => {
      if (!Array.isArray(b.assignments) || !b.assignments.length || b.assignments.length > 5000)
        fail('Lista de asocieri este invalidă.');
      return store.commit(
        b,
        'asociere-achitari',
        () => {
          const seen = new Set();
          for (const { id, childId } of b.assignments) {
            if (seen.has(id)) fail(`Achitarea ${id} apare de două ori.`);
            seen.add(id);
            const old = store.readRecord('payments', id);
            if (!old) fail(`Achitarea ${id} nu mai există. Reîncarcă datele.`, 409);
            if (old.childId) fail(`Achitarea ${id} are deja un copil asociat.`, 409);
            if (!store.recordExists('children', childId)) fail(`Copilul ${childId} nu există.`);
            const r = normalizeRecord('payments', { ...old, childId });
            store.writeRecord('payments', r);
            store.audit('asociere achitare', 'payments', r.id, old, r);
          }
        },
        true,
      );
    },

    '/api/import-preview': b => importReport(b.state),

    '/api/financial-preview': b => {
      const current = store.envelope();
      const plan = financialImportPlan(b, current.state);
      return {
        summary: plan.summary,
        skipped: plan.skipped,
        mappedChildren: plan.mappedChildren,
        revision: current.revision,
      };
    },

    '/api/financial-import': b => {
      if (b.confirm !== 'IMPORT ISTORIC') fail('Confirmă importul istoricului financiar.');
      return store.commit(
        b,
        'import-istoric',
        () => {
          const plan = financialImportPlan(b, store.readState());
          if (!plan.summary.payments && !plan.summary.expenses) fail('Istoricul este deja importat.');
          for (const type of ['payments', 'expenses'])
            for (const r of plan.additions[type]) {
              store.writeRecord(type, r);
              store.audit('import istoric V5', type, r.id, null, r);
            }
        },
        true,
      );
    },

    '/api/children-csv-preview': b => {
      const current = store.envelope();
      return { ...previewChildrenCSV(b.csv, current.state.children), revision: current.revision };
    },

    '/api/children-csv': b => {
      if (b.confirm !== 'IMPORT COPII') fail('Scrie IMPORT COPII pentru confirmare.');
      return store.commit(
        b,
        'import-copii',
        () => {
          const report = previewChildrenCSV(b.csv, store.readState().children);
          if (report.errors.length) fail(report.errors.join('\n'));
          if (!report.additions.length) fail('Nu există copii noi de importat.');
          for (const r of report.additions) {
            store.writeRecord('children', r);
            store.audit('import copii CSV', 'children', r.id, null, r);
          }
        },
        true,
      );
    },

    '/api/import': b => {
      if (b.confirm !== 'IMPORT') fail('Confirmă importul.');
      const s = validateState(b.state);
      return store.commit(b, 'import', () => store.replace(s, 'import'), true);
    },

    '/api/restore': b => {
      if (b.confirm !== 'RESTAUREAZA') fail('Confirmă restaurarea.');
      const s = validateState(snapshotState(backups.selectedBackup(b.name)));
      return store.commit(b, 'restaurare', () => store.replace(s, 'restaurare'), true);
    },

    '/api/backup': () => ({ ok: true, ...backups.backup(), health: backups.health() }),

    '/api/settings': b => {
      const folder = String(b.externalDir || '').trim();
      checkExternalDir(folder, [dataDir, backupDir]);
      const before = setting('externalDir');
      setSetting('externalDir', folder);
      if (before !== folder) {
        setSetting('lastExternal', '');
        setSetting('externalError', '');
      }
      store.audit('configurare backup', null, null, { externalDir: before }, { externalDir: folder });
      return { ok: true, ...backups.safeBackup('configurare'), health: backups.health() };
    },

    // Ruta de scriere a versiunii vechi. Un mesaj explicit este mai util decât 404.
    '/api/state': () => fail('Această versiune este veche. Reîncarcă pagina.', 409),
  };

  const routes = [
    ...Object.entries(read).map(([path, handler]) => ({ method: 'GET', path, handle: ({ url }) => handler(url) })),
    ...createAuditLogRoutes({ auditLogRepository: store.auditLogRepository }),
    ...Object.entries(write).map(([path, handler]) => ({
      method: 'POST',
      path,
      handle: ({ body, url, response }) => handler(body, url, response),
    })),
  ];

  return createRouteDispatcher({ root, sessionToken: token, routes }).dispatchRequest;
}
