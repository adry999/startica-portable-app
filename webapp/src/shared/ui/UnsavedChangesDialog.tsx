import { Button } from './Button';
import { Dialog } from './Dialog';
import styles from './UnsavedChangesDialog.module.css';

/** Primele 3 câmpuri, apoi „și încă N” (40c) — dialogul nu listează câmpurile la nesfârșit. */
function formatChangedFields(fields: string[]): string {
  if (fields.length <= 3) return fields.join(', ');
  return `${fields.slice(0, 3).join(', ')} și încă ${fields.length - 3}`;
}

export interface UnsavedChangesDialogProps {
  open: boolean;
  /** Numele formularului, ex. "copilul nou" — folosit în titlu. */
  formName: string;
  /** Câmpurile modificate, ex. ["nume", "telefon"] — arătate ca listă scurtă, opțional. */
  changedFields?: string[];
  onDiscard: () => void;
  onStay: () => void;
  onSaveAndContinue: () => void;
  /** Butonul „Salvez și continui” arată starea de încărcare și ignoră clicurile suplimentare. */
  saving?: boolean;
}

/**
 * Trei alegeri la ieșirea dintr-un formular cu modificări nesalvate — Renunță / Rămân /
 * Salvez și continui — peste `Dialog`, la fel cum `ConfirmDialog` îl folosește pentru două
 * alegeri (COMPONENTE.md §0i, 34g).
 */
export function UnsavedChangesDialog({
  open,
  formName,
  changedFields,
  onDiscard,
  onStay,
  onSaveAndContinue,
  saving = false,
}: UnsavedChangesDialogProps) {
  return (
    <Dialog
      open={open}
      title={`Renunți la modificările din ${formName}?`}
      width={420}
      onClose={onStay}
      shouldBlockClose={() => saving}
      footer={
        <>
          <Button variant="danger-solid" disabled={saving} onClick={onDiscard}>
            Renunță
          </Button>
          <Button variant="outline" disabled={saving} onClick={onStay}>
            Rămân
          </Button>
          <Button variant="primary" loading={saving} onClick={onSaveAndContinue}>
            Salvez și continui
          </Button>
        </>
      }
    >
      {changedFields && changedFields.length > 0 && (
        <p className={styles.fields}>Câmpuri modificate: {formatChangedFields(changedFields)}.</p>
      )}
    </Dialog>
  );
}
