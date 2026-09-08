import { today } from './domain.mjs';
import { $ } from './ui/dom.mjs';
import { session, message, load, setRenderers, renderSaveStatus, checkConnection } from './ui/session.mjs';
import { pages } from './ui/parts.mjs';
import { go, render, renderList, renderHealth, profile, moreAudit } from './ui/views.mjs';
import { openEditor, bindEditorForm, archive, confirmReview } from './ui/editor.mjs';
import { bindTransfers } from './ui/transfers.mjs';

const HEALTH_POLL_MS = 30000;
const LISTS = ['children', 'payments', 'expenses'];

setRenderers({ render, health: renderHealth });
bindEditorForm();
bindTransfers();

// Un singur ascultător pentru toate butoanele generate dinamic: rândurile din
// tabele se redesenează des, iar ascultătorii individuali s-ar pierde.
document.addEventListener('click', async event => {
  const b = event.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.view) go(b.dataset.view);
    if (b.dataset.create) openEditor(b.dataset.create);
    if (b.dataset.close) {
      if (session.busy) {
        message('Așteaptă confirmarea salvării.', true);
        return;
      }
      $(b.dataset.close).close();
    }
    if (b.dataset.page) {
      pages[b.dataset.page] = Math.max(0, pages[b.dataset.page] + Number(b.dataset.delta));
      render();
    }
    const { action, type, id } = b.dataset;
    if (action === 'edit') openEditor(type, id);
    if (action === 'archive') await archive(type, id);
    if (action === 'profile') profile(id);
    if (action === 'confirm-review') await confirmReview(id);
  } catch (e) {
    message(e.message, true);
  }
});

// ─── Filtre ─────────────────────────────────────────────────────────────────

for (const type of LISTS)
  for (const suffix of ['Search', 'Archive', 'Month'])
    if ($(`${type}${suffix}`))
      $(`${type}${suffix}`).oninput = () => {
        pages[type] = 0;
        renderList(type);
      };

const refreshReview = () => {
  pages.review = 0;
  render();
};
$('reviewFilter').onchange = refreshReview;
$('reviewSearch').oninput = refreshReview;
$('reviewReset').onclick = () => {
  $('reviewFilter').value = 'all';
  $('reviewSearch').value = '';
  refreshReview();
};

$('selectedMonth').value = today().slice(0, 7);
$('selectedMonth').onchange = () => {
  if (!$('selectedMonth').value) $('selectedMonth').value = today().slice(0, 7);
  render();
};

// ─── Antet și istoric ───────────────────────────────────────────────────────

$('reloadButton').onclick = async () => {
  try {
    const recovering = !!session.pending;
    await load();
    // După recuperarea unei operațiuni neconfirmate, formularele deschise pot
    // conține date depășite: se închid, iar utilizatorul redeschide ce trebuie.
    if (recovering) {
      for (const id of ['editor', 'importDialog', 'restoreDialog', 'csvDialog']) $(id).close();
      session.csvData = null;
      session.editor = null;
    }
    message('Date reîncărcate. Pentru un formular în conflict, închide-l și redeschide înregistrarea.');
  } catch (e) {
    message(e.message, true);
  }
};
$('auditMore').onclick = () => void moreAudit().catch(e => message(e.message, true));
$('printButton').onclick = () => window.print();

// ─── Starea formularelor ────────────────────────────────────────────────────

$('editorForm').addEventListener('input', () => {
  session.editorDirty = true;
  renderSaveStatus();
});
$('editorForm').addEventListener(
  'invalid',
  () => {
    session.saveError = 'Verifică și completează câmpurile marcate în formular.';
    renderSaveStatus();
  },
  true,
);
$('editor').addEventListener('close', () => {
  session.editorDirty = false;
  renderSaveStatus();
});
$('externalDir').addEventListener('input', () => {
  session.settingsDirty = $('externalDir').value !== (session.health.externalDir || '');
  renderSaveStatus();
});

// Închiderea ferestrei sau a unui dialog nu trebuie să piardă tăcut o
// modificare nesalvată ori o operațiune neconfirmată.
window.addEventListener('beforeunload', event => {
  if (
    session.pending ||
    session.busy ||
    session.settingsBusy ||
    session.settingsDirty ||
    (session.editorDirty && $('editor').open)
  ) {
    event.preventDefault();
    event.returnValue = '';
  }
});
for (const dialog of document.querySelectorAll('dialog'))
  dialog.addEventListener('cancel', event => {
    if (session.busy) event.preventDefault();
  });

// ─── Pornire ────────────────────────────────────────────────────────────────

setInterval(checkConnection, HEALTH_POLL_MS);
window.addEventListener('focus', checkConnection);
load().catch(e => message('Pornește aplicația din Porneste_Startica.cmd. ' + e.message, true));
