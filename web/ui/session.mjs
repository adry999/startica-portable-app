import { emptyState } from '../../shared/domain.mjs';
import { $, time } from './dom.mjs';

// Toată starea mutabilă a interfeței, într-un singur obiect. Modulele îl
// importă prin referință, deci nu există copii care se pot desincroniza.
export const session = {
  state: emptyState(),
  revision: 0,
  token: '',
  health: {},
  ready: false,
  // Operațiunea trimisă, dar neconfirmată. Rămâne setată după o cădere de
  // rețea: reluarea ei folosește același requestId, deci serverul nu o aplică
  // de două ori.
  pending: null,
  busy: false,
  loading: false,
  checkingHealth: false,
  editor: null,
  editorDirty: false,
  importData: null,
  restoreData: null,
  csvData: null,
  csvLoading: false,
  settingsDirty: false,
  settingsBusy: false,
  settingsError: '',
  lastSavedAt: '',
  saveError: '',
  connectionError: '',
};

// Randările complete sunt declanșate din session (de exemplu după accept()),
// dar sunt definite în views.mjs, care depinde de session. Punctul de intrare
// le înregistrează aici, ca dependența să rămână într-o singură direcție.
const renderers = { render: () => {}, health: () => {} };
export function setRenderers({ render, health }) {
  renderers.render = render;
  renderers.health = health;
}

export function message(text, error = false) {
  $('message').className = 'notice' + (error ? ' error' : '');
  $('message').textContent = text;
}

// Indicatorul din antet. Ordinea condițiilor este ordinea de gravitate: ultima
// care se potrivește câștigă, deci o eroare acoperă întotdeauna un „se salvează”.
export function renderSaveStatus() {
  const draft = session.editorDirty && $('editor').open,
    backupError = session.health.localError || session.health.externalError;
  let status = 'saved',
    label = 'Date salvate',
    detail = session.lastSavedAt ? 'Pe disc · ' + time(session.lastSavedAt) : 'Date încărcate de pe disc';
  if (!session.ready || session.loading) {
    status = 'pending';
    label = 'Se verifică datele…';
    detail = 'Se așteaptă confirmarea serverului';
  }
  if (draft || session.settingsDirty) {
    status = 'pending';
    label = 'Modificări nesalvate';
    detail = 'Apasă Salvează pentru a le păstra pe disc';
  }
  if (session.pending || session.busy || session.settingsBusy) {
    status = 'pending';
    label = 'Se salvează…';
    detail = 'Așteaptă confirmarea înainte de închidere';
  }
  if (backupError) {
    status = 'error';
    label = 'Problemă la backup';
    detail = backupError;
  }
  if (session.saveError || session.settingsError) {
    status = 'error';
    label = 'Salvare neconfirmată';
    detail = session.saveError || session.settingsError;
  }
  if (session.connectionError) {
    status = 'error';
    label = 'Conexiune întreruptă';
    detail = session.connectionError;
  }
  const indicator = $('saveIndicator');
  indicator.dataset.state = status;
  $('saveStatus').textContent = label;
  $('saveDetail').textContent = detail;
  indicator.title =
    detail +
    (session.lastSavedAt ? '\nUltima salvare confirmată: ' + time(session.lastSavedAt) : '') +
    '\nSalvarea locală nu confirmă sincronizarea Google Drive.';
}

// Serverul poate: (a) să nu răspundă — operațiunea are stare necunoscută și
// trebuie verificată; (b) să răspundă cu ceva ce nu e JSON — a fost contactat,
// deci nu e o problemă de conexiune. Cele două cazuri cer acțiuni diferite din
// partea utilizatorului, deci nu pot avea același mesaj.
const networkFailure = () => {
  session.connectionError = 'Apasă „Reîncarcă” pentru a verifica ultima operațiune.';
  renderSaveStatus();
  return Object.assign(Error('Conexiune întreruptă. ' + session.connectionError), { network: true });
};

export async function api(path, body) {
  let response;
  try {
    response = await fetch(path, {
      signal: AbortSignal.timeout(body === undefined ? 10000 : 60000),
      ...(body === undefined
        ? {}
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Startica-Token': session.token },
            body: JSON.stringify(body),
          }),
    });
  } catch {
    throw networkFailure();
  }
  let result;
  try {
    result = await response.json();
  } catch (e) {
    // Corpul întrerupt sau expirat rămâne o cădere de conexiune.
    if (e?.name === 'AbortError' || e?.name === 'TimeoutError') throw networkFailure();
    session.connectionError = '';
    renderSaveStatus();
    throw Object.assign(
      Error(`Serverul a răspuns neașteptat (cod ${response.status}). Apasă „Reîncarcă” și verifică jurnalele.`),
      { status: response.status },
    );
  }
  session.connectionError = '';
  renderSaveStatus();
  if (!response.ok) throw Object.assign(Error(result.error || 'Operațiunea a eșuat.'), { status: response.status });
  return result;
}

export function accept(result) {
  if (result.state) {
    session.state = result.state;
    session.revision = result.revision;
    session.ready = true;
    session.lastSavedAt = result.updatedAt || '';
    renderers.render();
  }
  if (result.health) {
    session.health = result.health;
    renderers.health();
  }
  if (result.warning) message(result.warning, true);
  renderSaveStatus();
}

async function executePending() {
  if (session.busy) return;
  session.busy = true;
  session.saveError = '';
  renderSaveStatus();
  try {
    const result = await api(session.pending.path, session.pending.body);
    session.pending = null;
    accept(result);
    if (!result.warning) message('Date salvate.');
    return result;
  } catch (e) {
    session.saveError = e.message;
    // Un răspuns cu status înseamnă că serverul a decis: operațiunea nu mai
    // este în aer, deci nu are rost reluată. Fără status, pending rămâne.
    if (e.status) {
      session.pending = null;
      if (e.status === 403) session.token = (await api('/api/session')).token;
    }
    message(e.message, true);
    throw e;
  } finally {
    session.busy = false;
    renderSaveStatus();
  }
}

export async function load() {
  if (session.busy || session.settingsBusy) return;
  if (session.pending) {
    await executePending();
    return;
  }
  session.loading = true;
  renderSaveStatus();
  try {
    session.token = (await api('/api/session')).token;
    accept(await api('/api/state'));
    session.health = await api('/api/health');
    session.saveError = '';
    renderers.health();
  } catch (e) {
    session.saveError = e.message;
    throw e;
  } finally {
    session.loading = false;
    renderSaveStatus();
  }
}

export async function mutate(path, body, base = session.revision) {
  if (!session.ready) throw Error('Așteaptă încărcarea datelor.');
  if (session.pending || session.busy) throw Error('Verifică operațiunea anterioară cu „Reîncarcă”.');
  session.pending = { path, body: { ...body, revision: base, requestId: crypto.randomUUID() } };
  return executePending();
}

export async function checkConnection() {
  if (
    !session.ready ||
    session.busy ||
    session.pending ||
    session.settingsBusy ||
    session.loading ||
    session.checkingHealth
  )
    return;
  session.checkingHealth = true;
  try {
    session.health = await api('/api/health');
    renderers.health();
  } catch (e) {
    message(e.message, true);
  } finally {
    session.checkingHealth = false;
  }
}
