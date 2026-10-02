import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  Field,
  LoadingState,
  RowMenu,
  SegmentedControl,
  Select,
  useToast,
} from '@shared/ui';
import { today } from '#shared/domain/calendar-month.mjs';
import { formatDayMonthNumeric } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { usePersonal } from '@shared/personal/usePersonal';
import { useSalaries } from './useSalaries';
import { PinGate } from './PinGate';
import { SalaryFormDrawer } from './SalaryFormDrawer';
import { AdvanceFormDrawer } from './AdvanceFormDrawer';
import { SalaryHistoryDrawer } from './SalaryHistoryDrawer';
import { AdvancesTab } from './AdvancesTab';
import styles from './SalariesView.module.css';
import { toUserError } from '@shared/api/to-user-error';

export interface SalariesViewProps {
  /** Luna arătată (YYYY-MM) — stepperul din antetul PersonalPage o controlează (23c). */
  month: string;
}

type SalariesSubTab = 'lista' | 'avansuri';

const METHODS = ['Cash', 'Card', 'Transfer'];

const MODE_LABEL: Record<'fix' | 'zi' | 'bazin', string> = { fix: 'Fix', zi: 'Pe zile', bazin: 'Bazin' };

/** Luna calendaristică precedentă lui `date` (YYYY-MM) — implicit pe „Lista lunii” (deja încheiată)
 * și plafonul stepperului din antet (o lună neîncheiată nu se poate plăti, M4/audit B). */
export function previousMonth(date: string): string {
  const year = Number(date.slice(0, 4));
  const monthIndex = Number(date.slice(5, 7));
  return monthIndex === 1 ? `${year - 1}-12` : `${year}-${String(monthIndex - 1).padStart(2, '0')}`;
}

/** Salarii (23c), în spatele PinGate (23d) — plata unui salariu = o cheltuială, minus avansurile lunii. */
export function SalariesView({ month }: SalariesViewProps) {
  // M8: PinGate ține deblocarea în starea lui locală (usePinStatus), separată de sesiunea
  // serverului — dacă PIN-ul expiră acolo (după 10 min), PinGate tot arată conținutul. Un
  // 403 pe /api/personal/salaries (status 'locked') remontează PinGate cu o cheie nouă, ca
  // să-și reîmprospăteze starea de deblocare de la server.
  const [pinGateKey, setPinGateKey] = useState(0);
  return (
    <PinGate key={pinGateKey}>
      <SalariesContent month={month} onLocked={() => setPinGateKey(key => key + 1)} />
    </PinGate>
  );
}

function SalariesContent({ month, onLocked }: { month: string; onLocked: () => void }) {
  const personal = usePersonal();
  const toast = useToast();
  const salaries = useSalaries(month);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState(METHODS[0]);
  const [paying, setPaying] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [salaryFormStaffId, setSalaryFormStaffId] = useState<string | null>(null);
  const [advanceStaffId, setAdvanceStaffId] = useState<string | null>(null);
  const [historyStaffId, setHistoryStaffId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<SalariesSubTab>('lista');

  useEffect(() => {
    if (salaries.status === 'locked') onLocked();
  }, [salaries.status, onLocked]);

  if (personal.status === 'loading' || salaries.status === 'loading') return <LoadingState />;
  // M8: 'locked' e tranzitoriu — chemarea de mai sus tocmai a cerut remontarea PinGate-ului.
  if (salaries.status === 'locked') return <LoadingState />;
  if (salaries.status === 'failed') return <p className={styles.notice}>{salaries.failureMessage}</p>;

  if (subTab === 'avansuri') {
    return (
      <div className={styles.root}>
        <SegmentedControl
          ariaLabel="Filă Salarii"
          value={subTab}
          onChange={setSubTab}
          options={[
            { value: 'lista', label: 'Lista lunii' },
            { value: 'avansuri', label: 'Avansuri' },
          ]}
        />
        <AdvancesTab />
      </div>
    );
  }

  function toggle(staffId: string) {
    setSelected(previous => {
      const next = new Set(previous);
      if (next.has(staffId)) next.delete(staffId);
      else next.add(staffId);
      return next;
    });
  }

  async function payment() {
    if (selected.size === 0) return;
    setPaying(true);
    try {
      const result = await salaries.pay([...selected], method);
      setSelected(new Set());
      setPayDialogOpen(false);
      toast.show({
        message:
          result.skipped.length > 0
            ? `${result.paid.length} plătiți, ${result.skipped.length} deja plătiți/blocați.`
            : `${result.paid.length} salarii plătite.`,
      });
    } catch (error) {
      toast.show({ message: toUserError(error) });
    } finally {
      setPaying(false);
    }
  }

  const payableRows = salaries.rows.filter(row => row.mode !== 'bazin' && row.mode !== null && !row.paid);
  const selectedTotal = salaries.rows
    .filter(row => selected.has(row.staff.id))
    .reduce((sum, row) => sum + (row.net ?? 0), 0);

  return (
    <div className={styles.root}>
      <SegmentedControl
        ariaLabel="Filă Salarii"
        value={subTab}
        onChange={setSubTab}
        options={[
          { value: 'lista', label: 'Lista lunii' },
          { value: 'avansuri', label: 'Avansuri' },
        ]}
      />

      <div className={styles.cards}>
        <Card tone="pink" decorative className={styles.card}>
          <span>Total salarii · {salaries.rows.length}</span>
          <strong>{formatMoney(salaries.totals?.gross ?? 0)}</strong>
        </Card>
        <Card className={styles.card}>
          <span>Avansuri date</span>
          <strong>{formatMoney(salaries.totals?.advances ?? 0)}</strong>
        </Card>
        <Card tone="mint" className={styles.card}>
          <span>Plătit</span>
          <strong>{formatMoney(salaries.totals?.paid ?? 0)}</strong>
        </Card>
        <Card className={`${styles.card} ${styles.cardOutlined}`}>
          <span>Rămas de plătit</span>
          <strong>{formatMoney((salaries.totals?.net ?? 0) - (salaries.totals?.paid ?? 0))}</strong>
        </Card>
      </div>

      <div className={styles.payBar}>
        <Button disabled={selected.size === 0} onClick={() => setPayDialogOpen(true)}>
          Plătește {selected.size > 0 ? `${selected.size} selectați` : ''}
        </Button>
      </div>

      <Card className={styles.tableCard}>
        <div className={styles.headRow}>
          <span />
          <span>Angajat</span>
          <span>Cum se calculează</span>
          <span>Baza lunii</span>
          <span>Salariu</span>
          <span>Avans</span>
          <span>De plătit</span>
          <span>Stare</span>
        </div>
        {salaries.rows.map(row => {
          const selectable = payableRows.some(payable => payable.staff.id === row.staff.id);
          return (
            <div
              key={row.staff.id}
              className={`${styles.row} ${selected.has(row.staff.id) ? styles.rowSelected : ''}`}
              onClick={() => setHistoryStaffId(row.staff.id)}
            >
              <span style={{ display: 'contents' }} onClick={event => event.stopPropagation()}>
                <Checkbox
                  ariaLabel={`Selectează ${row.staff.name}`}
                  checked={selected.has(row.staff.id)}
                  disabled={!selectable}
                  onChange={() => toggle(row.staff.id)}
                />
              </span>
              <span className={styles.employeeCell}>
                <strong>{row.staff.name}</strong>
                <small>{personal.roleName(row.staff.roleId)}</small>
              </span>
              <span>{row.mode ? <Badge tone="neutral">{MODE_LABEL[row.mode]}</Badge> : '—'}</span>
              {row.mode === null ? (
                <Button
                  variant="link"
                  className={styles.setSalaryLink}
                  onClick={event => {
                    event.stopPropagation();
                    setSalaryFormStaffId(row.staff.id);
                  }}
                >
                  + Setează salariul
                </Button>
              ) : (
                <span className={styles.baseCell}>{row.base}</span>
              )}
              <span>{row.gross === null ? '—' : formatMoney(row.gross)}</span>
              <span>{formatMoney(row.advances)}</span>
              <span className={styles.netCell}>{row.net === null ? '—' : formatMoney(row.net)}</span>
              <span className={styles.rowEnd} onClick={event => event.stopPropagation()}>
                {row.mode === null ? (
                  <Badge tone="neutral">Fără salariu setat</Badge>
                ) : row.mode === 'bazin' ? (
                  <Badge tone="mint">Din Bazin</Badge>
                ) : row.paid ? (
                  <Badge tone="mint">Plătit {formatDayMonthNumeric(row.paid.paidAt)}</Badge>
                ) : (
                  <Badge tone="yellow">De plătit</Badge>
                )}
                <RowMenu
                  items={[
                    { label: 'Avans', onClick: () => setAdvanceStaffId(row.staff.id) },
                    { label: 'Istoric', onClick: () => setHistoryStaffId(row.staff.id) },
                    {
                      label: 'Setează salariul',
                      onClick: () => setSalaryFormStaffId(row.staff.id),
                      disabled: row.mode === 'bazin',
                    },
                  ]}
                />
              </span>
            </div>
          );
        })}
      </Card>

      <p className={styles.footnote}>
        „Plătește” creează o cheltuială la categoria Salarii pentru fiecare angajat bifat, minus avansurile nescăzute
        ale lunii.
      </p>
      <p className={styles.footnote}>
        <strong>Fix</strong>: salariul de bază, pro-rata pentru absențe. <strong>Pe zile</strong>: tarif × zile lucrate.{' '}
        <strong>Bazin</strong>: calculat din programările Bazinului, plătit separat.
      </p>

      <Dialog
        open={payDialogOpen}
        title={`Plătește ${selected.size} ${selected.size === 1 ? 'salariu' : 'salarii'}`}
        ariaLabel="Confirmă plata"
        onClose={() => setPayDialogOpen(false)}
        shouldBlockClose={() => paying}
        footer={
          <>
            <Button variant="outline" disabled={paying} onClick={() => setPayDialogOpen(false)}>
              Anulează
            </Button>
            <Button loading={paying} onClick={() => void payment()}>
              Plătește · {formatMoney(selectedTotal)}
            </Button>
          </>
        }
      >
        <p className={styles.payDialogTotal}>
          Total: <strong>{formatMoney(selectedTotal)}</strong>
        </p>
        <Field label="Metoda plății" htmlFor="salaries-pay-method">
          <Select
            id="salaries-pay-method"
            value={method}
            onChange={setMethod}
            options={METHODS.map(option => ({ value: option, label: option }))}
          />
        </Field>
      </Dialog>

      {/* C2: key={staff?.id ?? 'closed'} — fără el, suma/modul angajatului anterior rămân în
          formular la deschiderea pentru un alt angajat (bani). */}
      <SalaryFormDrawer
        key={`salary-${salaryFormStaffId ?? 'closed'}`}
        staff={salaryFormStaffId ? (personal.staffById.get(salaryFormStaffId) ?? null) : null}
        onClose={() => setSalaryFormStaffId(null)}
        onSubmit={async input => {
          await salaries.saveSalary(input);
        }}
      />
      <AdvanceFormDrawer
        key={`advance-${advanceStaffId ?? 'closed'}`}
        staff={advanceStaffId ? (personal.staffById.get(advanceStaffId) ?? null) : null}
        // Avansurile se dau mereu în luna curentă (se dau în timpul ei, nu retroactiv), indiferent
        // de ce lună trecută arată stepperul din antet (`month`) — vezi comentariul de mai jos.
        month={today().slice(0, 7)}
        onClose={() => setAdvanceStaffId(null)}
        onSaved={salaries.reload}
      />
      <SalaryHistoryDrawer
        staff={historyStaffId ? (personal.staffById.get(historyStaffId) ?? null) : null}
        onClose={() => setHistoryStaffId(null)}
      />
    </div>
  );
}
