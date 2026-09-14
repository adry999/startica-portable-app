import { byId } from '#shared/ui/element-lookup.mjs';
import { createApiClient } from '#core/web/api-client.mjs';
import { createAppSessionStore } from '#core/web/app-session-store.mjs';
import { createNoticeBanner } from '#core/web/notice-banner.mjs';
import { createDomainEventBus } from '#core/web/domain-event-bus.mjs';
import { describeFailure } from '#core/web/view-state.mjs';
import { DOMAIN_EVENT_NAMES } from '#shared/contracts/domain-events.mjs';
import { createSaveIndicator } from './save-indicator.mjs';

// Bannerul și indicatorul de salvare se rezolvă abia la prima folosire, ca importul modulului să nu depindă de DOM.
/** @type {ReturnType<typeof createNoticeBanner> | undefined} */
let noticeBanner;
/**
 * @param {string} text
 * @param {boolean} [isError]
 */
export function showNotice(text, isError = false) {
  noticeBanner ??= createNoticeBanner(/** @type {HTMLElement} */ (byId('message')));
  noticeBanner.show(text, isError);
}

export const eventBus = createDomainEventBus({
  eventNames: DOMAIN_EVENT_NAMES,
  onListenerError: error => showNotice(describeFailure(error).message, true),
});

const apiClient = createApiClient({
  readSessionToken: () => store.state.token,
  reportConnection: errorMessage => {
    store.state.connectionError = errorMessage;
    renderSaveStatus();
  },
});
export const requestJson = apiClient.requestJson;

/** @type {ReturnType<typeof createSaveIndicator> | undefined} */
let saveIndicator;
export function renderSaveStatus() {
  saveIndicator ??= createSaveIndicator({
    readState: () => store.state,
    isEditorOpen: () => /** @type {HTMLDialogElement} */ (byId('editor')).open,
    elements: {
      indicator: /** @type {HTMLElement} */ (byId('saveIndicator')),
      status: /** @type {HTMLElement} */ (byId('saveStatus')),
      detail: /** @type {HTMLElement} */ (byId('saveDetail')),
    },
  });
  saveIndicator.renderSaveStatus();
}

const store = createAppSessionStore({
  requestJson: apiClient.requestJson,
  eventBus,
  renderRecords: () => {},
  renderHealth: () => {},
  showNotice,
  renderSaveStatus,
});

// Starea mutabilă a interfeței, într-un singur obiect citit prin referință de toate ecranele.
export const sessionState = store.state;
export const setRenderers = store.setRenderers;
export const acceptResult = store.accept;
export const loadSession = store.load;
export const submitMutation = store.mutate;
export const checkConnection = store.checkConnection;
