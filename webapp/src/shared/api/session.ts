import { useSyncExternalStore } from 'react';
import { createApiClient } from '@core/web/api-client.mjs';
import { createAppSessionStore } from '@core/web/app-session-store.mjs';
import { createDomainEventBus } from '@core/web/domain-event-bus.mjs';
import { DOMAIN_EVENT_NAMES } from '@contracts/domain-events.mjs';

/**
 * Sesiunea și snapshot-ul de date sunt refolosite neschimbate din backend
 * (src/core/web/app-session-store.mjs): revizie pentru concurență optimistă,
 * requestId pentru reluare idempotentă după cădere de rețea, reîmprospătare
 * token la 403. Reimplementarea acestei logici într-un hook React ar fi
 * riscat regresii pe ceva deja corect.
 *
 * Bannerul „Date salvate." dispare în redesign — starea de salvare trăiește
 * doar în cardul din sidebar (state.saveError/connectionError/busy/pending),
 * citită direct de componenta care randează sidebar-ul.
 */

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;

function notify() {
  version += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getVersion() {
  return version;
}

export const eventBus = createDomainEventBus({
  eventNames: DOMAIN_EVENT_NAMES,
  onListenerError: (error: unknown, eventName: string) => console.error(`Eveniment ${eventName} a eșuat`, error),
});

const apiClient = createApiClient({
  readSessionToken: () => store.state.token,
  reportConnection: (errorMessage: string) => {
    store.state.connectionError = errorMessage;
    notify();
  },
});

export const requestJson = apiClient.requestJson;

const store = createAppSessionStore({
  requestJson: apiClient.requestJson,
  eventBus,
  renderRecords: notify,
  renderHealth: notify,
  showNotice: (message: string, isError?: boolean) => {
    if (isError) console.error(message);
  },
  renderSaveStatus: notify,
});

export interface AppSession {
  state: typeof store.state;
  load: typeof store.load;
  mutate: typeof store.mutate;
  checkConnection: typeof store.checkConnection;
}

/** Un singur store, la nivel de modul (nu per componentă) — oglinda sessionState din app-session.mjs. */
export function useAppSession(): AppSession {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return {
    state: store.state,
    load: store.load,
    mutate: store.mutate,
    checkConnection: store.checkConnection,
  };
}
