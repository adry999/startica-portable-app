import { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useToast } from '@shared/ui';
import { useAppSession, requestJson } from '@shared/api/session';
import { readDirtyForms, type DirtyForm } from '@shared/state/dirty-forms';
import { viewForPathname, VIEW_PATHS } from './routes';

const SWITCH_NOTE_KEY = 'branch.switched';

export interface BranchTarget {
  id: string;
  name: string;
}

interface SwitchNote {
  from: string;
  fromId: string;
  to: string;
}

/**
 * Trimite comutarea la server, lasă un bilet în sessionStorage pentru toast-ul
 * de după reîncărcare, apoi reîncarcă pe aceeași cale de modul (fără sub-rută,
 * fără query — criteriul „rămâi pe același modul, cu filtrele resetate”).
 * Funcție simplă, nu hook: e folosită și din useBranchSwitch (cu ecranul de
 * așteptare), și direct din acțiunea „Înapoi la” a toast-ului (App.tsx).
 */
export async function performBranchSwitch(
  target: BranchTarget,
  current: { id: string; name: string } | null,
  pathname: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await requestJson('/api/branches/select', { id: target.id });
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
  const note: SwitchNote = { from: current?.name ?? '', fromId: current?.id ?? '', to: target.name };
  try {
    sessionStorage.setItem(SWITCH_NOTE_KEY, JSON.stringify(note));
  } catch {
    // Toast-ul „Acum lucrezi în…” e doar o comoditate — lipsa lui nu blochează comutarea.
  }
  window.location.replace(VIEW_PATHS[viewForPathname(pathname)]);
  return { ok: true };
}

/** Citește o singură dată biletul lăsat de performBranchSwitch înainte de reîncărcare. */
export function readBranchSwitchNote(): SwitchNote | null {
  try {
    const raw = sessionStorage.getItem(SWITCH_NOTE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(SWITCH_NOTE_KEY);
    return JSON.parse(raw) as SwitchNote;
  } catch {
    return null;
  }
}

export interface BranchSwitchDialogState {
  form: DirtyForm;
  fromName: string;
  toName: string;
}

export interface UseBranchSwitchResult {
  switching: { toName: string } | null;
  dialog: BranchSwitchDialogState | null;
  requestSwitch: (branchId: string) => void;
  stay: () => void;
  discardAndSwitch: () => void;
  saveAndSwitch: () => void;
}

/** Algoritmul din 17-filiale.md 13a/13b: verifică operațiunea în curs, formularul nesalvat, apoi comută. */
export function useBranchSwitch(): UseBranchSwitchResult {
  const session = useAppSession();
  const toast = useToast();
  const location = useLocation();
  const [switching, setSwitching] = useState<{ toName: string } | null>(null);
  const [dialog, setDialog] = useState<(BranchSwitchDialogState & { target: BranchTarget }) | null>(null);

  const runSwitch = useCallback(
    async (target: BranchTarget) => {
      setSwitching({ toName: target.name });
      const result = await performBranchSwitch(target, session.state.branch, location.pathname);
      if (!result.ok) {
        setSwitching(null);
        toast.show({ message: result.message });
      }
    },
    [session.state.branch, location.pathname, toast],
  );

  const requestSwitch = useCallback(
    (branchId: string) => {
      if (session.state.busy || session.state.pending) {
        toast.show({ message: 'Verifică operațiunea anterioară cu „Reîncarcă”.' });
        return;
      }
      if (branchId === session.state.branch?.id) return;
      const target = session.state.branches.find(candidate => candidate.id === branchId);
      if (!target) return;
      const dirty = readDirtyForms();
      if (dirty.length > 0) {
        setDialog({ form: dirty[0], fromName: session.state.branch?.name ?? '', toName: target.name, target });
        return;
      }
      void runSwitch(target);
    },
    [session.state.busy, session.state.pending, session.state.branch, session.state.branches, runSwitch, toast],
  );

  const stay = useCallback(() => setDialog(null), []);

  const discardAndSwitch = useCallback(() => {
    if (!dialog) return;
    const { target } = dialog;
    setDialog(null);
    void runSwitch(target);
  }, [dialog, runSwitch]);

  const saveAndSwitch = useCallback(() => {
    if (!dialog) return;
    const { form, target } = dialog;
    void form.save().then(saved => {
      if (!saved) return;
      setDialog(null);
      void runSwitch(target);
    });
  }, [dialog, runSwitch]);

  return { switching, dialog, requestSwitch, stay, discardAndSwitch, saveAndSwitch };
}
