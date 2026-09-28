import { downloadCsv } from '@shared/csv-export';
import type { PaymentRowView } from './usePayments';

/** Exportă lista de achitări filtrată (antet 05-achitari.md §2) — coloanele vizibile din tabel. */
export function exportPaymentsCsv(filename: string, rows: PaymentRowView[]): void {
  downloadCsv(
    filename,
    ['Data', 'Copil', 'Plătitor', 'Metodă', 'Luni acoperite', 'Total'],
    rows.map(row => [
      row.dateLabel,
      row.unassigned ? '—' : row.childLabel,
      row.sourceName || '',
      row.tenders.map(tender => tender.method).join(' + '),
      row.allocations.map(allocation => allocation.label).join(' + '),
      row.total,
    ]),
  );
}
