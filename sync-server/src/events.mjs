/**
 * Fanout local pentru SSE — doar trezirea polling-ului (decizia 7): un `event: change`
 * după fiecare push aplicat, ca celălalt calculator să nu mai aștepte până la 15 s.
 */
export function createEventHub() {
  /** @type {Map<string, Set<import('node:http').ServerResponse>>} */
  const subscribersByBranch = new Map();

  /**
   * @param {string} branchId
   * @param {import('node:http').ServerResponse} response
   * @returns {() => void} dezabonare
   */
  function subscribe(branchId, response) {
    const subscribers = subscribersByBranch.get(branchId) ?? new Set();
    subscribers.add(response);
    subscribersByBranch.set(branchId, subscribers);
    return () => {
      subscribers.delete(response);
      if (subscribers.size === 0) subscribersByBranch.delete(branchId);
    };
  }

  /** @param {string} branchId @param {number} seq */
  function publish(branchId, seq) {
    const subscribers = subscribersByBranch.get(branchId);
    if (!subscribers) return;
    const chunk = `event: change\ndata: ${JSON.stringify({ seq })}\n\n`;
    for (const response of subscribers) response.write(chunk);
  }

  /** Oprirea serverului: fiecare conexiune SSE deschisă se închide curat. */
  function closeAll() {
    for (const subscribers of subscribersByBranch.values()) for (const response of subscribers) response.end();
    subscribersByBranch.clear();
  }

  return { subscribe, publish, closeAll };
}
