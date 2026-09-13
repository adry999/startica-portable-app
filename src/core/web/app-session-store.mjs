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
        if (failure.status === 403) state.token = (await requestJson('/api/session')).token;
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
    renderSaveStatus();
    try {
      state.token = (await requestJson('/api/session')).token;
      accept(await requestJson('/api/state'));
      state.health = await requestJson('/api/health');
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
