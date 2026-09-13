import { ViewStatus, describeFailure } from '#core/web/view-state.mjs';

/** @typedef {import('../audit-log.types.mjs').AuditEntry} AuditEntry */
/** @typedef {import('../audit-log.types.mjs').AuditPage} AuditPage */
/** @typedef {import('#core/web/view-state.mjs').ViewFailure} ViewFailure */

/**
 * @typedef {object} AuditLogScreenState
 * @property {string} status
 * @property {AuditEntry[]} entries
 * @property {boolean} hasMore
 * @property {boolean} isLoadingMore
 * @property {ViewFailure | null} failure
 */

/** @type {Readonly<AuditLogScreenState>} */
const OPENING_STATE = Object.freeze({
  status: ViewStatus.Loading,
  entries: [],
  hasMore: false,
  isLoadingMore: false,
  failure: null,
});

/**
 * @param {{
 *   fetchAuditPage: (beforeEntryId: number | null) => Promise<AuditPage>,
 *   renderAuditLog: (state: AuditLogScreenState) => void,
 * }} dependencies
 */
export function createAuditLogController({ fetchAuditPage, renderAuditLog }) {
  /** @type {AuditLogScreenState} */
  let state = OPENING_STATE;
  /** @type {number | null} */
  let nextBeforeEntryId = null;
  // Fiecare deschidere a ecranului invalidează răspunsurile întârziate ale celei anterioare.
  let openingId = 0;

  /** @param {Partial<AuditLogScreenState>} changes */
  function update(changes) {
    state = { ...state, ...changes };
    renderAuditLog(state);
  }

  async function openFirstPage() {
    const currentOpeningId = ++openingId;
    nextBeforeEntryId = null;
    update(OPENING_STATE);
    try {
      const page = await fetchAuditPage(null);
      if (currentOpeningId !== openingId) return;
      nextBeforeEntryId = page.nextBeforeEntryId;
      update({
        status: page.entries.length ? ViewStatus.Ready : ViewStatus.Empty,
        entries: page.entries,
        hasMore: page.nextBeforeEntryId !== null,
      });
    } catch (error) {
      if (currentOpeningId === openingId) update({ status: ViewStatus.Failed, failure: describeFailure(error) });
    }
  }

  async function loadNextPage() {
    if (state.status !== ViewStatus.Ready || !state.hasMore || state.isLoadingMore) return;
    const currentOpeningId = openingId;
    update({ isLoadingMore: true, failure: null });
    try {
      const page = await fetchAuditPage(nextBeforeEntryId);
      if (currentOpeningId !== openingId) return;
      nextBeforeEntryId = page.nextBeforeEntryId;
      update({
        entries: [...state.entries, ...page.entries],
        hasMore: page.nextBeforeEntryId !== null,
        isLoadingMore: false,
      });
    } catch (error) {
      // Paginile deja afișate rămân; eșecul privește doar continuarea.
      if (currentOpeningId === openingId) update({ isLoadingMore: false, failure: describeFailure(error) });
    }
  }

  return { openFirstPage, loadNextPage, getState: () => state };
}
