import { renderGuarded } from '#core/web/view-state.mjs';

/** @typedef {import('#core/web/view-state.mjs').ViewFailure} ViewFailure */

/**
 * @typedef {object} RenderContext
 * @property {string} month
 * @property {any} review
 * @property {any[]} evaluations toți copiii, inclusiv arhivați
 * @property {any[]} activeEvaluations doar copiii nearhivați
 * @property {Map<string, unknown[]>} unassignedPaymentHintsByChild
 */

/**
 * @param {{
 *   readRecords: () => any,
 *   readSelectedMonth: () => string,
 *   readToday: () => string,
 *   buildReviewCenter: (records: any) => any,
 *   evaluateChildrenForMonth: (records: any, month: string, asOf: string) => Array<{ child: any }>,
 *   findUnassignedPaymentHintsByChild: (records: any) => Map<string, unknown[]>,
 *   reportRenderFailure: (screenName: string, failure: ViewFailure) => void,
 * }} dependencies
 */
export function createRenderCycle({
  readRecords,
  readSelectedMonth,
  readToday,
  buildReviewCenter,
  evaluateChildrenForMonth,
  findUnassignedPaymentHintsByChild,
  reportRenderFailure,
}) {
  /** @type {Array<{ screenName: string, renderScreen: (context: RenderContext) => void }>} */
  const screens = [];

  /**
   * Ecranele se randează în ordinea înregistrării.
   * @param {string} screenName
   * @param {(context: RenderContext) => void} renderScreen
   */
  function addScreen(screenName, renderScreen) {
    screens.push({ screenName, renderScreen });
  }

  // Evaluările, centrul de verificare și indiciile se calculează o singură dată pe randare, pentru toate ecranele.
  function render() {
    const records = readRecords();
    const month = readSelectedMonth();
    const evaluations = evaluateChildrenForMonth(records, month, readToday());
    /** @type {RenderContext} */
    const context = {
      month,
      review: buildReviewCenter(records),
      evaluations,
      activeEvaluations: evaluations.filter(evaluation => !evaluation.child.archived),
      unassignedPaymentHintsByChild: findUnassignedPaymentHintsByChild(records),
    };
    for (const { screenName, renderScreen } of screens)
      renderGuarded(screenName, () => renderScreen(context), reportRenderFailure);
  }

  return { addScreen, render };
}
