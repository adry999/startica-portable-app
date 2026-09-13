// Fațadă temporară: implementările au mutat în #shared/format și #shared/ui.
export { byId as $ } from '#shared/ui/element-lookup.mjs';
export { setNavCount } from '#shared/ui/nav-count-badge.mjs';
export { escapeHtml as esc } from '#shared/format/html-escape.mjs';
export { formatMoney as money } from '#shared/format/money-format.mjs';
export {
  formatDate as date,
  formatMonthLabel as monthLabel,
  formatDateTime as time,
  formatAge as age,
} from '#shared/format/date-format.mjs';
export { formatFileSize as fileSize } from '#shared/format/file-size-format.mjs';
