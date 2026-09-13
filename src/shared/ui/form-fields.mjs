import { escapeHtml } from '#shared/format/html-escape.mjs';

// Port 1:1 al `field()`/`select()`/`textarea()` din web/ui/parts.mjs, folosit
// de dialogul de editare generic și de câmpurile specifice fiecărui tip.

export function textFieldMarkup(name, label, value = '', type = 'text', extra = '') {
  return `<label class="field">${label}<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${extra}></label>`;
}

// Valoarea curentă este adăugată la opțiuni chiar dacă nu este una dintre cele
// oferite, ca editarea unei fișe vechi să nu îi schimbe tăcut câmpul.
export function selectFieldMarkup(name, label, value, choices) {
  const options = [...new Set([value, ...choices])]
    .map(
      v => `<option value="${escapeHtml(v)}" ${v === value ? 'selected' : ''}>${escapeHtml(v || 'Neasociat')}</option>`,
    )
    .join('');
  return `<label class="field">${label}<select name="${name}">${options}</select></label>`;
}

export function textareaFieldMarkup(name, label, value) {
  return `<label class="field full">${label}<textarea name="${name}">${escapeHtml(value || '')}</textarea></label>`;
}
