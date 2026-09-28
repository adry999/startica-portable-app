import { emptyState } from '#shared/domain/record-schema.mjs';
import { DomainEvent } from '#shared/contracts/domain-events.mjs';

/** @typedef {{ path: string, body: Record<string, unknown> }} PendingMutation */

/**
 * @param {{
 *   requestJson: (path: string, body?: unknown) => Promise<any>,
 *   eventBus: import('#shared/contracts/domain-event-payloads.mjs').DomainEventBus,
 *   renderRecords: () => void,
 *   renderHealth: () => void,
 *   showNotice: (text: string, isError?: boolean) => void,
 *   renderSaveStatus: () => void,
 *   createRequestId?: () => string,
 *   reload?: () => void,
 * }} dependencies
 */
export function createAppSessionStore({
  requestJson,
  eventBus,
  renderRecords,
  renderHealth,
  showNotice,
  renderSaveStatus,
  createRequestId = () => crypto.randomUUID(),
  // Fără efect implicit (teste care nu dau `window`): apelantul din browser
  // (webapp/src/shared/api/session.ts) leagă window.location.reload.
  reload = () => {},
}) {
  const renderers = { render: renderRecords, health: renderHealth };
  /** @param {{ render: () => void, health: () => void }} newRenderers */
  function setRenderers({ render, health }) {
    renderers.render = render;
    renderers.health = health;
  }

  // Toată starea mutabilă a interfeței, într-un singur obiect. Modulele îl
  // primesc prin referință, deci nu există copii care se pot desincroniza.
  const state = {
    state: emptyState(),
    revision: 0,
    token: '',
    version: '',
    // Filiala deschisă acum și lista completă (17-filiale.md) — null/[] înainte de primul load().
    /** @type {{ id: string, name: string, color: string, address: string } | null} */
    branch: null,
    /** @type {{ id: string, name: string, color: string, address: string }[]} */
    branches: [],
    health: {},
    ready: false,
    // Operațiunea trimisă, dar neconfirmată. Rămâne setată după o cădere de
    // rețea: reluarea ei folosește același requestId, deci serverul nu o aplică
    // de două ori.
    /** @type {PendingMutation | null} */
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
    // Cronologia reală a pornirii (ms epoch), pentru ecranul de încărcare (21a):
    // pașii lui vin din aceste evenimente, nu dintr-un timer separat.
    /** @type {{ startedAt: number | null, serverAt: number | null, databaseAt: number | null, syncAt: number | null }} */
    startupTimings: { startedAt: null, serverAt: null, databaseAt: null, syncAt: null },
    // Sincronizare (18-sincronizare.md): null pe o instalare fără sync.json — cardul
    // din sidebar rămâne „Salvat · ora” exact ca astăzi, fără nicio cerere suplimentară.
    // `connection` se completează abia după pasul de pornire de mai jos (21a).
    /** @type {{ configured: boolean, deviceName: string, serverUrl: string, connection?: 'online' | 'offline' | 'revoked' } | null} */
    sync: null,
  };

  /** @param {any} result */
  function accept(result) {
    if (result.state) {
      state.state = result.state;
      state.revision = result.revision;
      state.ready = true;
      state.lastSavedAt = result.updatedAt || '';
      renderers.render();
      eventBus.publish(DomainEvent.RecordsReloaded, { revision: state.revision });
    }
    if (result.health) {
      state.health = result.health;
      renderers.health();
    }
    if (result.warning) showNotice(result.warning, true);
    renderSaveStatus();
  }

  async function executePending() {
    if (state.busy) return;
    // Apelanții (load, mutate) garantează că pending e setat înainte de a chema executePending.
    const pending = /** @type {PendingMutation} */ (state.pending);
    state.busy = true;
    state.saveError = '';
    renderSaveStatus();
    try {
      const result = await requestJson(pending.path, pending.body);
      state.pending = null;
      accept(result);
      if (!result.warning) showNotice('Date salvate.');
      return result;
    } catch (e) {
      const failure = /** @type {Error & { status?: number }} */ (e);
      state.saveError = failure.message;
      // Un răspuns cu status înseamnă că serverul a decis: operațiunea nu mai
      // este în aer, deci nu are rost reluată. Fără status, pending rămâne.
      if (failure.status) {
        state.pending = null;
        // 403 la scriere înseamnă tokenul de sesiune nu mai e valid pentru contextul
        // activ (filiala s-a schimbat dintr-o altă filă, sau aplicația a repornit) —
        // A-1: reîncărcarea, nu o simplă reîmprospătare de token, ca fila să vadă
        // datele reale ale contextului curent, nu pe cele vechi cu un token nou.
        if (failure.status === 403) reload();
      }
      showNotice(failure.message, true);
      throw failure;
    } finally {
      state.busy = false;
      renderSaveStatus();
    }
  }

  async function load() {
    if (state.busy || state.settingsBusy) return;
    if (state.pending) {
      await executePending();
      return;
    }
    state.loading = true;
    if (!state.startupTimings.startedAt) state.startupTimings.startedAt = Date.now();
    renderSaveStatus();
    try {
      const session = await requestJson('/api/session');
      state.token = session.token;
      state.version = session.version || '';
      state.branch = session.branch ?? null;
      state.branches = session.branches ?? [];
      state.sync = session.sync ?? null;
      state.startupTimings.serverAt = Date.now();
      accept(await requestJson('/api/state'));
      state.startupTimings.databaseAt = Date.now();
      state.health = await requestJson('/api/health');
      // Pasul „Sincronizez cu serverul comun” (21a) — doar când e configurat; nu
      // blochează pornirea, fără internet e un răspuns valid al rutei locale.
      if (state.sync) {
        try {
          const syncStatus = await requestJson('/api/sync/status');
          state.sync = { ...state.sync, connection: syncStatus.connection };
        } catch {
          // Rută locală — nu ar trebui să pice; dacă totuși pică, pasul rămâne „pending”.
        }
        state.startupTimings.syncAt = Date.now();
      }
      state.saveError = '';
      renderers.health();
    } catch (e) {
      const failure = /** @type {Error} */ (e);
      state.saveError = failure.message;
      throw failure;
    } finally {
      state.loading = false;
      renderSaveStatus();
    }
  }

  /**
   * @param {string} path
   * @param {Record<string, unknown>} body
   * @param {number} [base]
   */
  async function mutate(path, body, base = state.revision) {
    if (!state.ready) throw Error('Așteaptă încărcarea datelor.');
    if (state.pending || state.busy) throw Error('Verifică operațiunea anterioară cu „Reîncarcă”.');
    state.pending = { path, body: { ...body, revision: base, requestId: createRequestId() } };
    return executePending();
  }

  async function checkConnection() {
    if (!state.ready || state.busy || state.pending || state.settingsBusy || state.loading || state.checkingHealth)
      return;
    state.checkingHealth = true;
    try {
      state.health = await requestJson('/api/health');
      renderers.health();
    } catch (e) {
      showNotice(/** @type {Error} */ (e).message, true);
    } finally {
      state.checkingHealth = false;
    }
  }

  return { state, setRenderers, accept, load, mutate, checkConnection };
}
