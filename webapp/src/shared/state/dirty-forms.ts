import { useEffect, useRef } from 'react';

/**
 * Un formular cu modificări nesalvate — 13b (17-filiale.md). `label` e articulat
 * („o achitare”, „o fișă de copil”), ca „Ai <label> nesalvată în <filiala>” să se
 * citească firesc. `save` rulează salvarea formularului și întoarce `true` doar
 * dacă s-a salvat efectiv (validarea locală care refuză nu apelează `onSubmit`).
 */
export interface DirtyForm {
  label: string;
  save: () => Promise<boolean>;
}

// Registru la nivel de modul, nu React context: useBranchSwitch (alt subarbore,
// în Sidebar) trebuie să vadă formularul nesalvat al unui drawer oriunde e montat.
const registry = new Set<DirtyForm>();

/**
 * Înregistrează formularul cât timp `form` nu e null; se dezînregistrează la
 * demontare sau când `form` devine null (formular curat/închis). `save` poate
 * fi refăcut la fiecare randare fără să reînregistreze — se ține într-un ref.
 */
export function useDirtyForm(form: DirtyForm | null): void {
  const saveRef = useRef(form?.save ?? null);
  saveRef.current = form?.save ?? null;
  const label = form?.label ?? null;

  useEffect(() => {
    if (!label) return;
    const entry: DirtyForm = { label, save: () => saveRef.current!() };
    registry.add(entry);
    return () => {
      registry.delete(entry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);
}

/** Formularele nesalvate înregistrate acum — useBranchSwitch citește primul. */
export function readDirtyForms(): DirtyForm[] {
  return [...registry];
}
