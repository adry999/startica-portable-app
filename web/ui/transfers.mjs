import { today } from '../../shared/domain.mjs';
import { readWorkbook, exportWorkbook } from '../../shared/excel.mjs';
import { $, esc, date, time } from './dom.mjs';
import { session, api, accept, message, mutate, renderSaveStatus } from './session.mjs';
import { parentContacts, summaryHTML } from './parts.mjs';

const CSV_MAX_BYTES = 2000000;
const EXCEL_MAX_BYTES = 20000000;

// vendor/xlsx.full.min.js are ~950 KB; se încarcă abia la primul import/export
// Excel, nu pe calea de pornire a aplicației.
let xlsxLoading;
function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  // O eroare de rețea nu trebuie să rămână cache-uită: o cerere reluată
  // trebuie să reîncerce, nu să eșueze mereu cu promisiunea veche.
  xlsxLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/vendor/xlsx.full.min.js';
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(Error('Nu s-a putut încărca modulul Excel.'));
    document.head.append(script);
  }).catch(e => {
    xlsxLoading = undefined;
    throw e;
  });
  return xlsxLoading;
}

// ─── Import copii din CSV ───────────────────────────────────────────────────

function csvPreviewHTML(file, report) {
  const rows = report.rows
    .map(
      r =>
        `<tr><td>${r.line} / ${esc(r.contractNumber)}</td><td>${esc(r.name)}</td><td>${parentContacts(r)}</td>` +
        `<td>${date(r.birthDate)}<br>${date(r.attendanceDate)}</td>` +
        `<td>${esc(r.reason)}${r.warnings.map(w => `<br><small>${esc(w)}</small>`).join('')}</td></tr>`,
    )
    .join('');
  return (
    `<p><strong>${esc(file.name)}</strong></p>` +
    `<p>${report.total} rânduri · ${report.additions.length} copii noi · ${report.skipped} existenți, nemodificați · ${report.conflicts} conflicte, neimportate</p>` +
    report.errors.map(e => `<p class="danger">${esc(e)}</p>`).join('') +
    report.warnings.map(w => `<p>${esc(w)}</p>`).join('') +
    `<div class="table-wrap"><table><thead><tr><th>Rând / contract</th><th>Copil</th><th>Părinte / telefon</th><th>Naștere / frecventare</th><th>Rezultat</th></tr></thead><tbody>${rows}</tbody></table></div>`
  );
}

function bindChildrenCsv() {
  $('importChildrenButton').onclick = () => {
    if (!session.ready || session.pending || session.busy || session.csvLoading) {
      message('Așteaptă sau reîncarcă datele înainte de import.', true);
      return;
    }
    $('childrenCsvInput').click();
  };

  $('childrenCsvInput').onchange = async event => {
    const file = event.target.files[0];
    if (!file || session.csvLoading) return;
    session.csvLoading = true;
    session.csvData = null;
    $('commitCsv').disabled = true;
    $('csvError').textContent = '';
    try {
      if (file.size > CSV_MAX_BYTES) throw Error('CSV prea mare (maximum 2 MB).');
      // fatal: true => un fișier care nu e UTF-8 este respins, nu citit greșit.
      const csv = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      const report = await api('/api/children-csv-preview', { csv });
      $('csvConfirm').value = '';
      $('csvPreview').innerHTML = csvPreviewHTML(file, report);
      if (!report.errors.length && report.additions.length)
        session.csvData = { csv, revision: report.revision, count: report.additions.length };
      $('csvDialog').showModal();
    } catch (e) {
      message(e.message, true);
    } finally {
      session.csvLoading = false;
      event.target.value = '';
    }
  };

  $('csvConfirm').oninput = () => {
    $('commitCsv').disabled = !session.csvData || $('csvConfirm').value !== 'IMPORT COPII';
  };

  $('commitCsv').onclick = async () => {
    if (!session.csvData || session.busy) return;
    $('commitCsv').disabled = true;
    $('csvError').textContent = '';
    try {
      const count = session.csvData.count;
      const result = await mutate(
        '/api/children-csv',
        { csv: session.csvData.csv, confirm: $('csvConfirm').value },
        session.csvData.revision,
      );
      $('csvDialog').close();
      session.csvData = null;
      if (!result.warning)
        message(`${count} copii importați. Fișele existente, achitările și cheltuielile au fost păstrate.`);
    } catch (e) {
      $('csvError').textContent = e.message;
      message(e.message, true);
    } finally {
      $('commitCsv').disabled = !session.csvData || !!session.pending;
    }
  };

  // Cât timp o operațiune este neconfirmată, datele previzualizate trebuie
  // păstrate pentru reluare.
  $('csvDialog').addEventListener('close', () => {
    if (!session.pending) session.csvData = null;
  });
}

// ─── Import și export Excel ─────────────────────────────────────────────────

function bindExcel() {
  $('importButton').onclick = () => $('excelInput').click();

  $('excelInput').onchange = async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > EXCEL_MAX_BYTES) throw Error('Fișier prea mare (maximum 20 MB).');
      const XLSX = await loadXLSX();
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      const parsed = readWorkbook(workbook, XLSX);
      let report = parsed;
      // Serverul revalidează; avertizările locale despre sursă se păstrează.
      if (!parsed.errors.length) {
        const checked = await api('/api/import-preview', { state: parsed.state });
        report = { ...checked, warnings: [...parsed.warnings] };
      }
      session.importData = report.errors.length ? null : { state: report.state, revision: session.revision };
      $('importConfirm').value = '';
      $('commitImport').disabled = !session.importData;
      $('importPreview').innerHTML =
        `<p>${esc(file.name)}</p>` +
        `<p class="notice">Datele curente (${session.state.children.length} copii, ${session.state.payments.length} plăți, ${session.state.expenses.length} cheltuieli) vor fi înlocuite după backup.</p>` +
        (report.summary ? summaryHTML(report.summary) : '') +
        report.errors.map(e => `<p class="danger">${esc(e)}</p>`).join('') +
        `<details open><summary>${report.warnings.length} avertizări</summary>${report.warnings.map(w => `<p>${esc(w.id || '')} ${esc(w.reason)}</p>`).join('')}</details>`;
      $('importDialog').showModal();
    } catch (e) {
      message(e.message, true);
    } finally {
      event.target.value = '';
    }
  };

  $('commitImport').onclick = async () => {
    if (!session.importData) return;
    $('commitImport').disabled = true;
    try {
      await mutate(
        '/api/import',
        { state: session.importData.state, confirm: $('importConfirm').value },
        session.importData.revision,
      );
      $('importDialog').close();
      session.importData = null;
    } catch (e) {
      message(e.message, true);
    } finally {
      $('commitImport').disabled = false;
    }
  };

  $('exportButton').onclick = async () => {
    if (!session.ready || session.pending) {
      message('Reîncarcă datele înainte de export.', true);
      return;
    }
    try {
      const XLSX = await loadXLSX();
      XLSX.writeFile(exportWorkbook(session.state, XLSX), `Startica_complet_${today()}.xlsx`, { compression: true });
    } catch (e) {
      message(e.message, true);
    }
  };
}

// ─── Backup, restaurare și setări ───────────────────────────────────────────

async function previewRestore() {
  session.restoreData = null;
  $('commitRestore').disabled = true;
  const name = $('backupSelect').value;
  if (!name) return;
  const s = await api('/api/backup-preview?name=' + encodeURIComponent(name));
  // Selecția s-a schimbat cât timp răspunsul era pe drum.
  if ($('backupSelect').value !== name) return;
  session.restoreData = { name, revision: session.revision };
  $('restorePreview').innerHTML = summaryHTML(s) + s.errors.map(e => `<p class="danger">${esc(e)}</p>`).join('');
  $('commitRestore').disabled = !!s.errors.length;
}

function bindBackup() {
  $('backupButton').onclick = async () => {
    const b = $('backupButton');
    b.disabled = true;
    try {
      const result = await api('/api/backup', {});
      accept(result);
      if (!result.warning) message('Backup local verificat creat.');
    } catch (e) {
      message(e.message, true);
    } finally {
      b.disabled = false;
    }
  };

  $('restoreButton').onclick = async () => {
    try {
      const backups = await api('/api/backups');
      if (!backups.length) throw Error('Nu există backupuri.');
      $('backupSelect').innerHTML = backups
        .map(b => `<option value="${esc(b.name)}">${esc(time(b.modified))} · ${esc(b.name)}</option>`)
        .join('');
      $('restoreConfirm').value = '';
      $('restoreDialog').showModal();
      await previewRestore();
    } catch (e) {
      message(e.message, true);
    }
  };

  $('backupSelect').onchange = () => previewRestore().catch(e => message(e.message, true));

  $('commitRestore').onclick = async () => {
    if (!session.restoreData) return;
    $('commitRestore').disabled = true;
    try {
      await mutate(
        '/api/restore',
        { name: session.restoreData.name, confirm: $('restoreConfirm').value },
        session.restoreData.revision,
      );
      $('restoreDialog').close();
    } catch (e) {
      message(e.message, true);
    } finally {
      $('commitRestore').disabled = false;
    }
  };

  $('settingsForm').onsubmit = async event => {
    event.preventDefault();
    if (session.settingsBusy || session.pending || session.busy) return;
    const b = event.currentTarget.querySelector('button'),
      folder = $('externalDir');
    b.disabled = true;
    folder.disabled = true;
    session.settingsBusy = true;
    session.settingsError = '';
    renderSaveStatus();
    try {
      const result = await api('/api/settings', { externalDir: folder.value });
      session.settingsDirty = false;
      accept(result);
      if (!result.warning)
        message(
          session.health.externalDir
            ? 'Copia în folderul extern a fost verificată. Confirmă separat sincronizarea în Google Drive.'
            : 'Backup local configurat.',
        );
    } catch (e) {
      session.settingsError = e.message;
      message(e.message, true);
    } finally {
      b.disabled = false;
      folder.disabled = false;
      session.settingsBusy = false;
      renderSaveStatus();
    }
  };
}

export function bindTransfers() {
  bindChildrenCsv();
  bindExcel();
  bindBackup();
}
