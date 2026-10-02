import { useState } from 'react';
import { readDirtyForms, type DirtyForm } from '@shared/state/dirty-forms';
import type { ViewKey } from './nav-items';

/** „o achitare” → „achitare” — `UnsavedChangesDialog` cere un nume fără articol nehotărât
 * („Renunți la modificările din {nume}?”), dar `DirtyForm.label` e articulat pentru
 * `BranchSwitchDialog` („Ai o achitare nesalvată”) — aproximare generică, suficientă aici. */
function bareLabel(label: string): string {
  return label.replace(/^(o|un)\s+/, '');
}

export interface PendingNavigation {
  form: DirtyForm;
  view: ViewKey;
  params?: Record<string, string>;
}

export interface NavigationGuardResult {
  /** De dat Sidebar-ului în locul lui `onNavigate` direct (40c §8.1 — navigarea în alt modul). */
  guardedNavigate: (view: ViewKey, params?: Record<string, string>) => void;
  pending: PendingNavigation | null;
  formName: string;
  stay: () => void;
  discardAndNavigate: () => void;
  saveAndNavigate: () => void;
  saving: boolean;
}

/**
 * Garda de navigare între module (40c, PROMPT-8 §8.1): dacă un formular nesalvat e înregistrat
 * (`useDirtyForm`), schimbarea modulului din Sidebar cere confirmare în loc să-l închidă tăcut —
 * același algoritm ca `useBranchSwitch` (13b), dar pentru navigarea internă, nu pentru filială.
 * Nu foloseşte `useBlocker` din react-router: aplicația rulează cu `<BrowserRouter>`, nu cu un
 * data router (`createBrowserRouter`/`RouterProvider`), iar `useBlocker` cere explicit un data
 * router — migrarea routerului e o schimbare mult mai amplă, în afara acestui punct.
 */
export function useNavigationGuard(
  currentView: ViewKey,
  navigate: (view: ViewKey, params?: Record<string, string>) => void,
): NavigationGuardResult {
  const [pending, setPending] = useState<PendingNavigation | null>(null);
  const [saving, setSaving] = useState(false);

  function guardedNavigate(view: ViewKey, params?: Record<string, string>) {
    if (view === currentView) {
      navigate(view, params);
      return;
    }
    const [form] = readDirtyForms();
    if (form) {
      setPending({ form, view, params });
      return;
    }
    navigate(view, params);
  }

  function stay() {
    setPending(null);
  }

  function discardAndNavigate() {
    if (!pending) return;
    const { view, params } = pending;
    setPending(null);
    navigate(view, params);
  }

  function saveAndNavigate() {
    if (!pending) return;
    const { form, view, params } = pending;
    setSaving(true);
    void form
      .save()
      .then(saved => {
        if (!saved) return;
        setPending(null);
        navigate(view, params);
      })
      .finally(() => setSaving(false));
  }

  return {
    guardedNavigate,
    pending,
    formName: pending ? bareLabel(pending.form.label) : '',
    stay,
    discardAndNavigate,
    saveAndNavigate,
    saving,
  };
}
