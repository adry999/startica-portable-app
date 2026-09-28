/**
 * Fanout local pentru SSE — doar trezirea polling-ului (decizia 7): un `event: change`
 * după fiecare push aplicat, ca celălalt calculator să nu mai aștepte până la 15 s.
 *
 * Plafon și contrapresiune (D-9): un dispozitiv ține cel mult un flux per filială — un
 * al doilea (tab nou, reconectare) îl închide pe cel vechi, ca să nu se acumuleze conexiuni
 * fără limită; un abonat cu bufferul de scriere plin (`writableNeedDrain`) e sărit la
 * `publish`, ca un client care nu citește să nu acumuleze memorie nelimitată pe server.
 */
export function createEventHub() {
  /** @type {Map<string, Map<string, import('node:http').ServerResponse>>} */
  const subscribersByBranch = new Map();

  /**
   * @param {string} branchId
   * @param {string} deviceId
   * @param {import('node:http').ServerResponse} response
   * @returns {() => void} dezabonare
   */
  function subscribe(branchId, deviceId, response) {
    const subscribers = subscribersByBranch.get(branchId) ?? new Map();
    const previous = subscribers.get(deviceId);
    if (previous && previous !== response) previous.end();
    subscribers.set(deviceId, response);
    subscribersByBranch.set(branchId, subscribers);
    return () => {
      // Nu șterge fluxul curent dacă între timp dispozitivul s-a reconectat și l-a înlocuit.
      if (subscribers.get(deviceId) === response) subscribers.delete(deviceId);
      if (subscribers.size === 0) subscribersByBranch.delete(branchId);
    };
  }

  /** @param {string} branchId @param {number} seq */
  function publish(branchId, seq) {
    const subscribers = subscribersByBranch.get(branchId);
    if (!subscribers) return;
    const chunk = `event: change\ndata: ${JSON.stringify({ seq })}\n\n`;
    for (const response of subscribers.values()) {
      if (response.writableNeedDrain) continue;
      response.write(chunk);
    }
  }

  /** Oprirea serverului: fiecare conexiune SSE deschisă se închide curat. */
  function closeAll() {
    for (const subscribers of subscribersByBranch.values()) for (const response of subscribers.values()) response.end();
    subscribersByBranch.clear();
  }

  return { subscribe, publish, closeAll };
}
