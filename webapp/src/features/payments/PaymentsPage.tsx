import { useNavigate } from 'react-router-dom';
import { Button, LoadingState, SegmentedControl, useToast, useTopbarActions } from '@shared/ui';
import { usePersistedState } from '@shared/state/usePersistedState';
import { usePayments } from './usePayments';
import { exportPaymentsCsv } from './payments-export';
import { PaymentsTable } from './PaymentsTable';
import { PaymentsByMonth } from './PaymentsByMonth';
import { PaymentFormDrawer } from './PaymentFormDrawer';
import type { PaymentFormValues } from './payment-form';
import type { Payment } from '@contracts/record-types.mjs';
import { today } from '@domain/calendar-month.mjs';
import styles from './PaymentsPage.module.css';

type ViewMode = 'table' | 'months';

const VIEW_MODE_OPTIONS = [
  { value: 'table' as ViewMode, label: 'Tabel' },
  { value: 'months' as ViewMode, label: 'Pe luna încasării' },
];

export interface PaymentsPageProps {
  /** Sursa formularului deschis — controlată din URL (/achitari/nou sau /achitari/:paymentId) de ruta din App.tsx. */
  formTargetId: string | null;
  onOpenCreate: () => void;
  onOpenEdit: (id: string) => void;
  onCloseForm: () => void;
  /** Click pe un rând cu copil asociat — deschide fișa copilului (/copii/:id). */
  onOpenChild: (id: string) => void;
  /** Presetează filtrul „Copil" — venit din ?copil= (link „Toate achitările" din fișa copilului). */
  initialChildId?: string;
}

/** Orchestrator subțire (05-achitari.md §1): antetul + comutatorul între PaymentsTable și PaymentsByMonth. */
export function PaymentsPage({
  formTargetId,
  onOpenCreate,
  onOpenEdit,
  onCloseForm,
  onOpenChild,
  initialChildId,
}: PaymentsPageProps) {
  const paymentsData = usePayments(initialChildId);
  const toast = useToast();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = usePersistedState<ViewMode>('view.payments', 'table');

  function exportFiltered() {
    exportPaymentsCsv(`achitari-${today()}.csv`, paymentsData.status === 'ready' ? paymentsData.rows : []);
  }

  // Antetul e identic în Tabel și în Pe luni (05-achitari.md #2) — comutator + Exportă + Achitare nouă.
  useTopbarActions(
    <div className={styles.headerActions}>
      <SegmentedControl
        options={VIEW_MODE_OPTIONS}
        value={viewMode}
        onChange={setViewMode}
        ariaLabel="Mod de afișare"
      />
      {/* „Bon zi" nu e în spec (05-achitari.md #2) — rămâne accesibilă lângă Exportă, ca acțiune
          secundară suplimentară (decizie, conform notei din task: nu are sens într-un ⋯ de rând,
          bonul e pe zi, nu pe achitare). */}
      <Button variant="ghost" onClick={() => navigate(`/achitari/bon-zi?zi=${today()}`)}>
        Bon zi
      </Button>
      <Button variant="ghost" onClick={exportFiltered}>
        Exportă
      </Button>
      <Button onClick={onOpenCreate}>+ Achitare nouă</Button>
    </div>,
  );

  if (paymentsData.status === 'loading') return <LoadingState />;
  if (paymentsData.status === 'failed')
    return <p className={styles.notice}>{paymentsData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  const formTarget: Payment | 'new' | null =
    formTargetId === 'nou'
      ? 'new'
      : formTargetId
        ? (paymentsData.records.payments.find(p => p.id === formTargetId) ?? null)
        : null;

  // C1: întoarce succesul real, nu doar dacă cererea a pornit — „Salvează și schimbă” din
  // useBranchSwitch schimbă filiala doar când save() (deci și funcția asta) întoarce true.
  async function submitPaymentForm(values: PaymentFormValues): Promise<boolean> {
    try {
      const previous = formTarget && formTarget !== 'new' ? formTarget : null;
      if (previous) {
        await paymentsData.updatePayment(previous, values);
        onCloseForm();
        toast.show({ message: 'Achitare actualizată.' });
        return true;
      }
      const saved = await paymentsData.createPayment(values, () =>
        window.confirm(
          'Există o plată cu același copil, aceeași dată, sumă și metodă. Confirmi că este o plată distinctă?',
        ),
      );
      if (saved) {
        onCloseForm();
        toast.show({ message: 'Achitare adăugată.' });
      }
      return saved;
    } catch (error) {
      toast.show({ message: (error as Error).message });
      return false;
    }
  }

  return (
    <>
      {viewMode === 'table' ? (
        <PaymentsTable data={paymentsData} onEdit={onOpenEdit} onOpenChild={onOpenChild} />
      ) : (
        <PaymentsByMonth data={paymentsData} onEdit={onOpenEdit} />
      )}

      {/* C2: 'closed' e distinct de 'new' — la fiecare redeschidere „+ Achitare nouă” trece
          prin 'closed' (target null), deci instanța se remontează și useState pleacă de la
          valorile implicite, nu de la ultima achitare salvată. */}
      <PaymentFormDrawer
        key={formTarget === null ? 'closed' : formTarget === 'new' ? 'new' : formTarget.id}
        target={formTarget}
        records={paymentsData.records}
        onSubmit={submitPaymentForm}
        onClose={onCloseForm}
      />
    </>
  );
}
