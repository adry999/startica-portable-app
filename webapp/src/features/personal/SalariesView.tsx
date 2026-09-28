import { useState } from 'react';
import { Badge, Button, Card, LoadingState, RowMenu, SegmentedControl, useToast } from '@shared/ui';
import { today } from '#shared/domain/calendar-month.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { usePersonal } from '@shared/personal/usePersonal';
import { useSalaries } from './useSalaries';
import { PinGate } from './PinGate';
import { SalaryFormDrawer } from './SalaryFormDrawer';
import { AdvanceFormDrawer } from './AdvanceFormDrawer';
import { SalaryHistoryDrawer } from './SalaryHistoryDrawer';
import { AdvancesTab } from './AdvancesTab';
import styles from './SalariesView.module.css';

type SalariesSubTab = 'lista' | 'avansuri';

const METHODS = ['Cash', 'Card', 'Transfer'];

/** Luna calendaristică precedentă lui `date` (YYYY-MM) — vezi comentariul de la `month` mai jos. */
function previousMonth(date: string): string {
  const year = Number(date.slice(0, 4));
  const monthIndex = Number(date.slice(5, 7));
  return monthIndex === 1 ? `${year - 1}-12` : `${year}-${String(monthIndex - 1).padStart(2, '0')}`;
}

/** Salarii (23c), în spatele PinGate (23d) — plata unui salariu = o cheltuială, minus avansurile lunii. */
export function SalariesView() {
  return (
    <PinGate>
      <SalariesContent />
    </PinGate>
  );
}

function SalariesContent() {
  const personal = usePersonal();
  const toast = useToast();
  // „Lista lunii” arată luna precedentă, deja încheiată — pay() refuză o lună care nu s-a
  // încheiat (M4, audit B), și luna curentă nu ar avea niciodată ce plăti din acest ecran.
  // Avansurile rămân legate de luna curentă (se dau în timpul ei, nu retroactiv).
  const currentMonth = today().slice(0, 7);
  const month = previousMonth(currentMonth);
  const salaries = useSalaries(month);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState(METHODS[0]);
  const [paying, setPaying] = useState(false);
  const [salaryFormStaffId, setSalaryFormStaffId] = useState<string | null>(null);
  const [advanceStaffId, setAdvanceStaffId] = useState<string | null>(null);
  const [historyStaffId, setHistoryStaffId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<SalariesSubTab>('lista');

  if (personal.status === 'loading' || salaries.status === 'loading') return <LoadingState />;
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
      toast.show({
        message:
          result.skipped.length > 0
            ? `${result.paid.length} plătiți, ${result.skipped.length} deja plătiți/blocați.`
            : `${result.paid.length} salarii plătite.`,
      });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    } finally {
      setPaying(false);
    }
  }

  const payableRows = salaries.rows.filter(row => row.mode !== 'bazin' && !row.paid);

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
        <Card className={styles.card}>
          <span>Total</span>
          <strong>{formatMoney(salaries.totals?.gross ?? 0)}</strong>
        </Card>
        <Card className={styles.card}>
          <span>Avansuri</span>
          <strong>{formatMoney(salaries.totals?.advances ?? 0)}</strong>
        </Card>
        <Card className={styles.card}>
          <span>Plătit</span>
          <strong>{formatMoney(salaries.totals?.paid ?? 0)}</strong>
        </Card>
        <Card className={styles.card}>
          <span>Rămas</span>
          <strong>{formatMoney((salaries.totals?.net ?? 0) - (salaries.totals?.paid ?? 0))}</strong>
        </Card>
      </div>

      <div className={styles.payBar}>
        <select value={method} onChange={event => setMethod(event.target.value)} aria-label="Metoda plății">
          {METHODS.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <Button disabled={selected.size === 0 || paying} onClick={() => void payment()}>
          Plătește {selected.size > 0 ? `${selected.size} selectați` : ''}
        </Button>
      </div>

      <Card className={styles.tableCard}>
        <div className={styles.headRow}>
          <span />
          <span>Angajat</span>
          <span>Mod</span>
          <span>Bază</span>
          <span>Brut</span>
          <span>Avansuri</span>
          <span>Net</span>
          <span />
        </div>
        {salaries.rows.map(row => {
          const selectable = payableRows.some(payable => payable.staff.id === row.staff.id);
          return (
            <div key={row.staff.id} className={styles.row}>
              <input
                type="checkbox"
                aria-label={`Selectează ${row.staff.name}`}
                checked={selected.has(row.staff.id)}
                disabled={!selectable}
                onChange={() => toggle(row.staff.id)}
              />
              <span>{row.staff.name}</span>
              <span>{row.mode}</span>
              <span>{row.base}</span>
              <span>{formatMoney(row.gross)}</span>
              <span>{formatMoney(row.advances)}</span>
              <span>{formatMoney(row.net)}</span>
              <span className={styles.rowEnd}>
                {row.mode === 'bazin' ? (
                  <Badge tone="mint">Plătit din Bazin</Badge>
                ) : row.paid ? (
                  <Badge tone="mint">Plătit din {row.paid.branchId}</Badge>
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

      <SalaryFormDrawer
        staff={salaryFormStaffId ? (personal.staffById.get(salaryFormStaffId) ?? null) : null}
        onClose={() => setSalaryFormStaffId(null)}
        onSubmit={async input => {
          await salaries.saveSalary(input);
        }}
      />
      <AdvanceFormDrawer
        staff={advanceStaffId ? (personal.staffById.get(advanceStaffId) ?? null) : null}
        month={currentMonth}
        onClose={() => setAdvanceStaffId(null)}
      />
      <SalaryHistoryDrawer
        staff={historyStaffId ? (personal.staffById.get(historyStaffId) ?? null) : null}
        onClose={() => setHistoryStaffId(null)}
      />
    </div>
  );
}
