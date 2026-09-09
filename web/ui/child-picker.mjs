// Combobox reutilizabil pentru alegerea unui copil: input text căutabil (fără
// diacritice) + listă flotantă, în loc de un <select> lung, greu de parcurs
// manual când sunt mulți copii. Folosit la achitare (editor.mjs) și la
// asocierea achitărilor (assign.mjs, un rând per achitare neasociată).
import { esc } from './dom.mjs';
import { stripDiacritics } from '../../shared/text.mjs';

export const normalizeSearch = value => stripDiacritics(value).toLocaleLowerCase('ro-RO');

export function childPickerHTML({ name, selectedId = '', selectedLabel = '', placeholder = 'Caută copil după nume…' }) {
  return (
    `<div class="combobox" data-child-picker>` +
    `<input type="text" class="child-picker-input" value="${esc(selectedLabel)}" placeholder="${esc(placeholder)}" autocomplete="off">` +
    `<input type="hidden" class="child-picker-value" ${name ? `name="${esc(name)}"` : ''} value="${esc(selectedId)}">` +
    `<div class="combobox-list" hidden></div>` +
    `</div>`
  );
}

// O singură listă poate fi deschisă simultan, deci un singur ascultător de
// scroll global e suficient — un tabel cu 200 de rânduri altfel ar acumula
// 200 de ascultători permanenți la fiecare re-randare (assign.mjs randează
// tabelul din nou la fiecare mutație de stare).
let openList = null;
if (typeof window !== 'undefined')
  window.addEventListener(
    'scroll',
    () => {
      if (openList) {
        openList.hidden = true;
        openList = null;
      }
    },
    true,
  );

// options: [{ id, label, group? }]. Grupurile consecutive primesc un antet;
// tabelul de asociere le folosește pentru „Nume potrivit”/„Doar sumă sau lună”.
// Listă poziționată fix (nu absolut): rândurile din tabele lungi au un
// container cu overflow:auto, care ar tăia orice listă poziționată absolut.
export function wireChildPicker(picker, options, onChange) {
  const search = picker.querySelector('.child-picker-input'),
    hidden = picker.querySelector('.child-picker-value'),
    list = picker.querySelector('.combobox-list');
  const place = () => {
    const rect = search.getBoundingClientRect();
    list.style.position = 'fixed';
    list.style.top = `${rect.bottom + 4}px`;
    list.style.left = `${rect.left}px`;
    list.style.width = `${rect.width}px`;
  };
  const close = () => {
    list.hidden = true;
    if (openList === list) openList = null;
  };
  const renderList = () => {
    const q = normalizeSearch(search.value);
    const matches = options.filter(o => !q || normalizeSearch(o.label).includes(q));
    let lastGroup;
    list.innerHTML =
      matches
        .map(o => {
          const header = o.group && o.group !== lastGroup ? `<div class="combobox-group">${esc(o.group)}</div>` : '';
          lastGroup = o.group;
          return header + `<div class="combobox-option" data-id="${esc(o.id)}">${esc(o.label)}</div>`;
        })
        .join('') || '<div class="combobox-empty">Niciun rezultat</div>';
    place();
    list.hidden = false;
    openList = list;
  };
  search.onfocus = renderList;
  search.oninput = renderList;
  // mousedown, nu click: fuge înaintea blur-ului de pe search, ca alegerea să nu fie anulată.
  list.onmousedown = e => {
    const opt = e.target.closest('[data-id]');
    if (!opt) return;
    hidden.value = opt.dataset.id;
    search.value = options.find(o => o.id === opt.dataset.id)?.label ?? opt.textContent;
    close();
    onChange?.(hidden.value);
  };
  search.onblur = () => setTimeout(close, 150);
}
