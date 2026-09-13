// Fațadă: compune infrastructura din core/web și păstrează exact numele de
// azi, ca `web/ui/*.mjs` și `web/app.js` să nu se schimbe până la pasul 10.
import { byId } from '#shared/ui/element-lookup.mjs';
import { createApiClient } from '#core/web/api-client.mjs';
import { createAppSessionStore } from '#core/web/app-session-store.mjs';
import { createNoticeBanner } from '#core/web/notice-banner.mjs';
import { createDomainEventBus } from '#core/web/domain-event-bus.mjs';
import { describeFailure } from '#core/web/view-state.mjs';
import { DOMAIN_EVENT_NAMES } from '#shared/contracts/domain-events.mjs';
import { createSaveIndicator } from '#app/web/save-indicator.mjs';

// Bannerul și indicatorul de salvare se rezolvă abia la prima folosire, ca
// importul acestui modul înainte de DOM ready să se comporte la fel ca azi.
let noticeBanner;
function getNoticeBanner() {
  if (!noticeBanner) noticeBanner = createNoticeBanner(byId('message'));
  return noticeBanner;
}
export function message(text, error = false) {
  getNoticeBanner().show(text, error);
}

export const eventBus = createDomainEventBus({
  eventNames: DOMAIN_EVENT_NAMES,
  onListenerError: error => message(describeFailure(error).message, true),
});

const apiClient = createApiClient({
  readSessionToken: () => store.state.token,
  reportConnection: errorMessage => {
    store.state.connectionError = errorMessage;
    renderSaveStatus();
  },
});
export const api = apiClient.requestJson;

let saveIndicator;
function getSaveIndicator() {
  if (!saveIndicator)
    saveIndicator = createSaveIndicator({
      readState: () => store.state,
      isEditorOpen: () => byId('editor').open,
      elements: { indicator: byId('saveIndicator'), status: byId('saveStatus'), detail: byId('saveDetail') },
    });
  return saveIndicator;
}
export function renderSaveStatus() {
  getSaveIndicator().renderSaveStatus();
}

const store = createAppSessionStore({
  requestJson: apiClient.requestJson,
  eventBus,
  renderRecords: () => {},
  renderHealth: () => {},
  showNotice: message,
  renderSaveStatus,
});

// Toată starea mutabilă a interfeței, într-un singur obiect. Modulele îl
// importă prin referință, deci nu există copii care se pot desincroniza.
export const session = store.state;
export const setRenderers = store.setRenderers;
export const accept = store.accept;
export const load = store.load;
export const mutate = store.mutate;
export const checkConnection = store.checkConnection;
