/**
 * @param {{ submitMutation: (path: string, body: Record<string, unknown>) => Promise<unknown> }} dependencies
 */
export function createVisitsApi({ submitMutation }) {
  return {
    /**
     * @param {string} visitId
     * @param {unknown} child
     */
    enrolChild: (visitId, child) => submitMutation('/api/visits-enrol', { visitId, child }),
  };
}
