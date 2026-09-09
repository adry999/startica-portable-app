import { today } from '../shared/domain.mjs';
import { $ } from './ui/dom.mjs';
import { session, message, load, setRenderers, renderSaveStatus, checkConnection } from './ui/session.mjs';
import { pages } from './ui/parts.mjs';
import {
  go,
  render,
  renderList,
  renderHealth,
  profile,
  moreAudit,
  bindGroups,
  bindCategories,
  bindBulkArchive,
} from './ui/views.mjs';
import { openEditor, bindEditorForm, archive, deleteRecord, confirmReview } from './ui/editor.mjs';
import { bindTransfers } from './ui/transfers.mjs';
import { bindFees } from './ui/fees.mjs';
import { bindAssign } from './ui/assign.mjs';

const HEALTH_POLL_MS = 30000;
const LISTS = ['children', 'payments', 'expenses'];

setRenderers({ render, health: renderHealth });
bindEditorForm();
bindTransfers();
bindFees();
bindAssign();
bindGroups();
bindCategories();
bindBulkArchive('payments');
bindBulkArchive('expenses');

// Pe ecrane înguste navigația devine un panou explicit; pe desktop CSS o
// afișează permanent, așa că nu folosim niciodată `hidden` pentru aceasta.
const mobileNavQuery = window.matchMedia('(max-width: 720px)');
function setMobileNav(open) {
  const isOpen = mobileNavQuery.matches && open;
  document.querySelector('.sidebar').classList.toggle('is-nav-open', isOpen);
  $('navToggle').setAttribute('aria-expanded', String(isOpen));
}
function resetMobileNav() {
  setMobileNav(false);
}
$('navToggle').onclick = () => {
  const sidebar = document.querySelector('.sidebar');
  setMobileNav(!sidebar.classList.contains('is-nav-open'));
};
if (mobileNavQuery.addEventListener) mobileNavQuery.addEventListener('change', resetMobileNav);
else mobileNavQuery.addListener(resetMobileNav);
resetMobileNav();

// Un singur ascultător pentru toate butoanele generate dinamic: rândurile din
// tabele se redesenează des, iar ascultătorii individuali s-ar pierde.
document.addEventListener('click', async event => {
  const b = event.target.closest('button');
  if (!b) return;
  try {
    if (b.dataset.view) go(b.dataset.view);
    if (b.dataset.scroll) $(b.dataset.scroll).scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    if (action === 'archive') {
      // Fără fereastră de confirmare: primul click doar cere confirmarea,
      // rămâne fix pe rând; al doilea, în 4 secunde, chiar arhivează.
      if (!b.classList.contains('confirm-pending')) {
        b.classList.add('confirm-pending');
        b.dataset.label = b.textContent;
        b.textContent = 'Sigur?';
        b._confirmTimer = setTimeout(() => {
          b.classList.remove('confirm-pending');
          b.textContent = b.dataset.label;
        }, 4000);
      } else {
        clearTimeout(b._confirmTimer);
        await archive(type, id);
      }
    }
    if (action === 'delete') await deleteRecord(type, id);
    if (action === 'profile') profile(id);
    if (action === 'confirm-review') await confirmReview(id);
  } catch (e) {
    message(e.message, true);
  }
});

// ─── Filtre ─────────────────────────────────────────────────────────────────

for (const type of LISTS)
  for (const suffix of ['Search', 'Archive', 'MonthFrom', 'MonthTo', 'Category', 'Child', 'Method'])
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

const MONTH_NAMES = [
  'Ianuarie',
  'Februarie',
  'Martie',
  'Aprilie',
  'Mai',
  'Iunie',
  'Iulie',
  'August',
  'Septembrie',
  'Octombrie',
  'Noiembrie',
  'Decembrie',
];
let monthPickerYear;

function monthParts(value) {
  const [year, month] = value.split('-').map(Number);
  return { year, month };
}

function closeMonthPicker() {
  $('monthMenu').hidden = true;
  $('monthTrigger').setAttribute('aria-expanded', 'false');
}

function renderMonthPicker() {
  const { year, month } = monthParts($('selectedMonth').value);
  if (!monthPickerYear) monthPickerYear = year;
  $('selectedMonthLabel').textContent = `${MONTH_NAMES[month - 1]} ${year}`;
  $('monthYear').textContent = monthPickerYear;
  $('monthOptions').innerHTML = MONTH_NAMES.map((name, index) => {
    const value = `${monthPickerYear}-${String(index + 1).padStart(2, '0')}`;
    return `<button class="month-option" type="button" role="option" data-month="${value}" aria-selected="${value === $('selectedMonth').value}">${name.slice(0, 3)}</button>`;
  }).join('');
}

$('selectedMonth').value = today().slice(0, 7);
monthPickerYear = monthParts($('selectedMonth').value).year;
renderMonthPicker();
$('selectedMonth').onchange = () => {
  if (!$('selectedMonth').value) $('selectedMonth').value = today().slice(0, 7);
  monthPickerYear = monthParts($('selectedMonth').value).year;
  renderMonthPicker();
  render();
};
$('monthTrigger').onclick = () => {
  const opening = $('monthMenu').hidden;
  $('monthMenu').hidden = !opening;
  $('monthTrigger').setAttribute('aria-expanded', String(opening));
  if (opening) renderMonthPicker();
};
function focusSelectedMonth() {
  const selected = $('monthOptions').querySelector('[aria-selected="true"]');
  (selected || $('monthOptions').querySelector('[data-month]'))?.focus();
}
$('monthTrigger').onkeydown = event => {
  if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  if ($('monthMenu').hidden) $('monthTrigger').click();
  focusSelectedMonth();
};
$('monthPrevYear').onclick = () => {
  monthPickerYear--;
  renderMonthPicker();
};
$('monthNextYear').onclick = () => {
  monthPickerYear++;
  renderMonthPicker();
};
$('monthOptions').onclick = event => {
  const option = event.target.closest('[data-month]');
  if (!option) return;
  $('selectedMonth').value = option.dataset.month;
  $('selectedMonth').dispatchEvent(new Event('change'));
  closeMonthPicker();
};
$('monthOptions').onkeydown = event => {
  const option = event.target.closest('[data-month]');
  if (!option) return;
  const options = [...$('monthOptions').querySelectorAll('[data-month]')];
  const index = options.indexOf(option);
  const offsets = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 };
  let next = null;
  if (event.key in offsets) next = options[(index + offsets[event.key] + options.length) % options.length];
  if (event.key === 'Home') next = options[0];
  if (event.key === 'End') next = options.at(-1);
  if (!next) return;
  event.preventDefault();
  next.focus();
};
document.addEventListener('click', event => {
  if (!$('monthControl').contains(event.target)) closeMonthPicker();
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const pickerWasOpen = !$('monthMenu').hidden;
  closeMonthPicker();
  if (pickerWasOpen) {
    $('monthTrigger').focus();
    return;
  }
  const sidebar = document.querySelector('.sidebar');
  if (sidebar.classList.contains('is-nav-open')) {
    setMobileNav(false);
    $('navToggle').focus();
  }
});

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
    message(
      recovering
        ? 'Date reîncărcate. Formularul deschis a fost închis — redeschide înregistrarea dacă mai ai nevoie de ea.'
        : 'Date reîncărcate.',
    );
  } catch (e) {
    message(e.message, true);
  }
};
$('auditMore').onclick = () => void moreAudit().catch(e => message(e.message, true));
function printView(view) {
  document.body.dataset.printView = view;
  window.print();
}
window.addEventListener('afterprint', () => delete document.body.dataset.printView);
$('printButton').onclick = () => printView('status');
$('printNotify').onclick = () => printView('notify');

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
