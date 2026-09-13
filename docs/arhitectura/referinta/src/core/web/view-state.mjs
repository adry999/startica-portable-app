import { ApiError } from './api-error.mjs';

export const ViewStatus = Object.freeze({
  Loading: 'loading',
  Ready: 'ready',
  Empty: 'empty',
  Failed: 'failed',
});

/** @typedef {{ message: string, retryable: boolean }} ViewFailure */

/**
 * @param {unknown} error
 * @returns {ViewFailure}
 */
export function describeFailure(error) {
  if (error instanceof ApiError) return { message: error.message, retryable: error.kind === 'network' };
  if (error instanceof Error) return { message: error.message, retryable: false };
  return { message: 'Operațiunea a eșuat.', retryable: false };
}

/**
 * Un ecran care aruncă la randare nu are voie să lase goale celelalte ecrane.
 * @param {string} screenName
 * @param {() => void} renderScreen
 * @param {(screenName: string, failure: ViewFailure) => void} reportRenderFailure
 */
export function renderGuarded(screenName, renderScreen, reportRenderFailure) {
  try {
    renderScreen();
  } catch (error) {
    reportRenderFailure(screenName, describeFailure(error));
  }
}
