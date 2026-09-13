/**
 * @param {{ readState: () => any, isEditorOpen: () => boolean }} dependencies
 */
export function bindUnsavedChangesGuard({ readState, isEditorOpen }) {
  // Închiderea ferestrei sau a unui dialog nu trebuie să piardă tăcut o
  // modificare nesalvată ori o operațiune neconfirmată.
  window.addEventListener('beforeunload', event => {
    const state = readState();
    if (
      state.pending ||
      state.busy ||
      state.settingsBusy ||
      state.settingsDirty ||
      (state.editorDirty && isEditorOpen())
    ) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  for (const dialog of Array.from(document.querySelectorAll('dialog')))
    dialog.addEventListener('cancel', event => {
      if (readState().busy) event.preventDefault();
    });
}
