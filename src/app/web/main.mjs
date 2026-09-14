import { byId } from '#shared/ui/element-lookup.mjs';
import { today } from '#shared/domain/calendar-month.mjs';
import { DomainEvent } from '#shared/contracts/domain-events.mjs';
import { buildReviewCenter } from '#features/review-center/index.web.mjs';
import { evaluateChildrenForMonth } from '#features/billing/index.web.mjs';
import { findUnassignedPaymentHintsByChild } from '#features/payment-assignment/index.web.mjs';
import {
  acceptResult,
  checkConnection,
  eventBus,
  loadSession,
  renderSaveStatus,
  requestJson,
  sessionState,
  setRenderers,
  showNotice,
  submitMutation as submitStoreMutation,
} from './app-session.mjs';
import { bindMobileNavigation } from './mobile-navigation.mjs';
import { bindMonthPicker, readSelectedMonth } from './month-picker.mjs';
import { createNavigation } from './navigation.mjs';
import { createRenderCycle } from './render-cycle.mjs';
import { bindUnsavedChangesGuard } from './unsaved-changes-guard.mjs';
import { composeScreens } from './compose-screens.mjs';
import { bindGlobalActions } from './global-actions.mjs';

const HEALTH_POLL_MS = 30000;

// Compoziția leagă id-uri din index.html de factory-uri tipate; tipul exact îl verifică fiecare factory.
/**
 * @param {string} id
 * @returns {any}
 */
const element = id => byId(id);
const readRecords = () => sessionState.state;
// Feature-urile trimit corpuri tipate diferit; store-ul le completează cu revizia și requestId-ul.
const submitMutation = /** @type {(path: string, body: any, base?: number) => Promise<any>} */ (submitStoreMutation);

const navigation = createNavigation({ byId });

const renderCycle = createRenderCycle({
  readRecords,
  readSelectedMonth,
  readToday: today,
  buildReviewCenter,
  evaluateChildrenForMonth,
  findUnassignedPaymentHintsByChild,
  reportRenderFailure: (_screenName, failure) => showNotice(failure.message, true),
});
// Abonate înaintea celorlalte ecrane: la reîncărcare și la schimbarea lunii se randează întâi tot.
eventBus.subscribe(DomainEvent.RecordsReloaded, () => renderCycle.render());
eventBus.subscribe(DomainEvent.SelectedMonthChanged, () => renderCycle.render());

const { recordEditor, childProfile } = composeScreens({
  element,
  sessionState,
  readRecords,
  requestJson,
  submitMutation,
  acceptResult,
  showNotice,
  renderSaveStatus,
  setRenderers,
  eventBus,
  renderCycle,
  navigation,
  readSelectedMonth,
});

// Calendarul se leagă înaintea navigației mobile: ascultătorul lui de Escape oprește propagarea
// când închide calendarul, ca cele două să nu reacționeze la aceeași apăsare.
bindMonthPicker({
  byId: element,
  onMonthChange: () => eventBus.publish(DomainEvent.SelectedMonthChanged, { month: readSelectedMonth() }),
});
bindMobileNavigation({ byId: element });

bindGlobalActions({
  element,
  sessionState,
  navigation,
  renderCycle,
  recordEditor,
  childProfile,
  showNotice,
  loadSession,
  renderSaveStatus,
});

bindUnsavedChangesGuard({ readState: () => sessionState, isEditorOpen: () => element('editor').open });

// ─── Pornire ────────────────────────────────────────────────────────────────

setInterval(checkConnection, HEALTH_POLL_MS);
window.addEventListener('focus', checkConnection);
loadSession().catch(error =>
  showNotice('Pornește aplicația din Porneste_Startica.vbs. ' + /** @type {Error} */ (error).message, true),
);
