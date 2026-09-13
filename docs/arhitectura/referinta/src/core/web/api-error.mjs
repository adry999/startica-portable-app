/** @typedef {'network' | 'rejected' | 'unexpected-response'} ApiFailureKind */

// network: serverul nu a răspuns, deci operațiunea are stare necunoscută și se reia cu același requestId.
export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ kind: ApiFailureKind, status?: number | null }} details
   */
  constructor(message, { kind, status = null }) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}
