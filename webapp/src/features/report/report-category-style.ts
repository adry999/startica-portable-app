import type { BadgeTone } from '@shared/ui';

export interface ReportCategoryStyle {
  tone: BadgeTone;
  color: string;
}

// Aceleași 5 categorii/culori ca `webapp/src/features/expenses/useExpenses.ts`
// (`categoryStyleFor`) — duplicat aici, nu importat, fiindcă acel fișier
// trăiește într-un alt feature de webapp și `architecture.test.ts` interzice
// importul feature→feature. Bucketing-ul (ce cheltuială cade în ce categorie)
// e calculat o singură dată în domeniu (`accounting-report.mjs`); aici e doar
// maparea etichetă → culoare, pentru Badge-ul din panoul „Cheltuieli pe categorii”.
const REPORT_CATEGORY_STYLES: Record<string, ReportCategoryStyle> = {
  Salarii: { tone: 'orange', color: 'var(--orange)' },
  Alimentație: { tone: 'yellow', color: 'var(--yellow)' },
  Utilități: { tone: 'mint', color: 'var(--mint)' },
  Materiale: { tone: 'pink', color: 'var(--pink)' },
  Întreținere: { tone: 'neutral', color: 'var(--subtle)' },
  Altele: { tone: 'neutral', color: 'var(--muted)' },
};

export function reportCategoryStyleFor(category: string): ReportCategoryStyle {
  return REPORT_CATEGORY_STYLES[category] ?? REPORT_CATEGORY_STYLES.Altele;
}
