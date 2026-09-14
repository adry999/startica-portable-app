import { escapeHtml } from '#shared/format/html-escape.mjs';
import { formatDate } from '#shared/format/date-format.mjs';
import { STATUS_HISTORY_VALUES } from '#shared/domain/record-schema.mjs';
import { defaultSetupMonth } from '../domain/child-fee-setup.mjs';

/** @typedef {import('#shared/contracts/record-types.mjs').Child} Child */
/** @typedef {import('#shared/contracts/record-types.mjs').Group} Group */

/**
 * @param {Group[]} groupsSortedByName
 * @param {string} selectedGroupId
 */
export function groupOptionsMarkup(groupsSortedByName, selectedGroupId) {
  return (
    `<option value="">Fără grupă</option>` +
    groupsSortedByName
      .map(
        group =>
          `<option value="${escapeHtml(group.id)}" ${group.id === selectedGroupId ? 'selected' : ''}>${escapeHtml(group.name)}</option>`,
      )
      .join('')
  );
}

/**
 * @param {Child} child
 * @param {Group[]} groupsSortedByName
 * @param {string} today
 */
export function feeSetupRowMarkup(child, groupsSortedByName, today) {
  const currentStatus = child.status || 'Activ';
  const statusOptions = [...new Set([currentStatus, ...STATUS_HISTORY_VALUES])]
    .map(
      status =>
        `<option value="${escapeHtml(status)}" ${status === currentStatus ? 'selected' : ''}>${escapeHtml(status)}</option>`,
    )
    .join('');
  const currentFee = child.feeHistory?.at(-1)?.amount ?? child.fee ?? '';
  return (
    `<tr data-child="${escapeHtml(child.id)}"><td>${escapeHtml(child.contractNumber || child.id)}</td><td>${escapeHtml(child.name)}</td>` +
    `<td>${formatDate(child.attendanceDate)}</td>` +
    `<td><select data-group data-group-initial="${escapeHtml(child.groupId || '')}">${groupOptionsMarkup(groupsSortedByName, child.groupId || '')}</select></td>` +
    `<td><input data-fee type="number" min="0" step="0.01" value="${escapeHtml(currentFee)}" data-fee-initial="${escapeHtml(currentFee)}" placeholder="taxă"></td>` +
    `<td><input data-from type="month" value="${escapeHtml(defaultSetupMonth(child, today))}"></td>` +
    `<td><select data-status data-status-initial="${escapeHtml(currentStatus)}">${statusOptions}</select></td></tr>`
  );
}
