/**
 * @param {{
 *   eventNames: readonly string[],
 *   onListenerError: (error: unknown, eventName: string) => void,
 * }} options
 */
export function createDomainEventBus({ eventNames, onListenerError }) {
  const knownEventNames = new Set(eventNames);
  /** @type {Map<string, Set<(payload: unknown) => unknown>>} */
  const listenersByEventName = new Map();

  /** @param {string} eventName */
  function assertKnownEvent(eventName) {
    if (!knownEventNames.has(eventName)) throw new TypeError(`Eveniment necunoscut: ${eventName}`);
  }

  /**
   * @param {string} eventName
   * @param {(payload: any) => unknown} listener
   * @returns {() => void}
   */
  function subscribe(eventName, listener) {
    assertKnownEvent(eventName);
    let listeners = listenersByEventName.get(eventName);
    if (!listeners) listenersByEventName.set(eventName, (listeners = new Set()));
    listeners.add(listener);
    return () => void listeners.delete(listener);
  }

  // Un abonat care eșuează nu oprește notificarea celorlalte ecrane.
  /**
   * @param {string} eventName
   * @param {unknown} payload
   */
  function publish(eventName, payload) {
    assertKnownEvent(eventName);
    for (const listener of [...(listenersByEventName.get(eventName) ?? [])]) {
      try {
        const result = listener(payload);
        if (result instanceof Promise) result.catch(error => onListenerError(error, eventName));
      } catch (error) {
        onListenerError(error, eventName);
      }
    }
  }

  return { subscribe, publish };
}
