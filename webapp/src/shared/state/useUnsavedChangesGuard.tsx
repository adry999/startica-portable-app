import { useState, type ReactElement } from 'react';
import { UnsavedChangesDialog } from '@shared/ui';
import { useDirtyForm } from './dirty-forms';

export interface UseUnsavedChangesGuardOptions {
  /** Adevărat cât formularul are modificări nesalvate. */
  dirty: boolean;
  /** Eticheta articulată nehotărât, pentru registru (13b) — ex. „o achitare”, ca în `useDirtyForm`. */
  label: string;
  /** Numele folosit în titlul dialogului — ex. „achitarea” sau „copilul nou”. Implicit `label`. */
  formName?: string;
  /** Câmpurile schimbate față de valorile inițiale — vezi `diffChangedFields`. */
  changedFields?: string[];
  save: () => Promise<boolean>;
  /** Închiderea reală a Drawer-ului/Dialogului (golește state-ul din ecranul părinte). */
  onClose: () => void;
}

export interface UseUnsavedChangesGuardResult {
  /** De dat ca `onClose` lui `Drawer`/`Dialog` — intercepteaza ×, Esc și clicul pe fundal (40c). */
  requestClose: () => void;
  /** `<UnsavedChangesDialog>` gata legat de starea gărzii — se randează lângă `Drawer`/`Dialog`. */
  confirmDialog: ReactElement;
}

/**
 * Extensie peste `useDirtyForm` (13b/40c): în plus față de înregistrarea în registrul global
 * (citit de `useBranchSwitch` și de garda de navigare între module), oferă un `onClose` de
 * înlocuire care arată `UnsavedChangesDialog` în loc să închidă direct — ×, Esc și fundalul
 * `Drawer`/`Dialog` trec toate prin același `onClose`, deci un singur punct de intercepție
 * acoperă toate cele trei căi (nu e nevoie de `shouldBlockClose` separat).
 */
export function useUnsavedChangesGuard({
  dirty,
  label,
  formName = label,
  changedFields,
  save,
  onClose,
}: UseUnsavedChangesGuardOptions): UseUnsavedChangesGuardResult {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useDirtyForm(dirty ? { label, save, changedFields } : null);

  function requestClose() {
    if (!dirty) {
      onClose();
      return;
    }
    setConfirmOpen(true);
  }

  function discard() {
    setConfirmOpen(false);
    onClose();
  }

  function stay() {
    setConfirmOpen(false);
  }

  async function saveAndContinue() {
    setSaving(true);
    try {
      const saved = await save();
      if (!saved) return;
      setConfirmOpen(false);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return {
    requestClose,
    confirmDialog: (
      <UnsavedChangesDialog
        open={confirmOpen}
        formName={formName}
        changedFields={changedFields}
        onDiscard={discard}
        onStay={stay}
        onSaveAndContinue={() => void saveAndContinue()}
        saving={saving}
      />
    ),
  };
}

/**
 * Numele câmpurilor schimbate față de valorile inițiale, pentru `UnsavedChangesDialog` (40c).
 * `labels` mapează cheile urmărite din formular la numele lor afișate — doar cheile din `labels`
 * sunt comparate, ca un câmp tehnic fără etichetă (ex. un id intern) să nu ajungă în dialog.
 */
export function diffChangedFields<T extends object>(
  current: T,
  initial: T,
  labels: Partial<Record<keyof T, string>>,
): string[] {
  const changed: string[] = [];
  for (const key of Object.keys(labels) as (keyof T)[]) {
    const fieldLabel = labels[key];
    if (!fieldLabel) continue;
    if (JSON.stringify(current[key]) !== JSON.stringify(initial[key])) changed.push(fieldLabel);
  }
  return changed;
}
