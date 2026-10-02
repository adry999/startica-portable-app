import { useDayClosingReceipt, type DayMethodTotals } from './useDayClosingReceipt';
import { CashSummaryCardView } from './CashSummaryCardView';

export interface CashSummaryCardProps {
  /** Ziua rezumată (ISO) — implicit azi, dată de pagina-părinte (Achitări). */
  date: string;
  /** 44c: clic pe un mini-card de metodă filtrează lista de dedesubt (metodă + ziua asta). */
  onFilterMethod?: (method: keyof DayMethodTotals) => void;
}

/**
 * 44c: „Casa de azi” — card deasupra listei de Achitări cu totalurile zilei pe metodă. Reutilizează
 * `useDayClosingReceipt` (deja calculează exact astea pentru bonul de închidere a zilei, 24b/§11).
 * Partea vizuală (inclusiv raportul A4 tipărit) stă în `CashSummaryCardView`, fără acces la sesiune
 * — testabilă/storyabilă cu date fixe, fără mock de `fetch`.
 *
 * Fără stare proprie de eroare: `useDayClosingReceipt` n-are `status: 'failed'` (o eroare de sesiune
 * e deja tratată mai sus, de `PaymentsPage`, înainte ca orice copil din Achitări să se randeze).
 */
export function CashSummaryCard({ date, onFilterMethod }: CashSummaryCardProps) {
  const data = useDayClosingReceipt(date);
  return (
    <CashSummaryCardView
      status={data.status}
      dateLabel={data.dateLabel}
      paymentCount={data.rows.length}
      totalsByMethod={data.totalsByMethod}
      onFilterMethod={onFilterMethod}
    />
  );
}
