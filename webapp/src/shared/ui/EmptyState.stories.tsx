import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { EmptyState, type EmptyStateProps } from './EmptyState';
import { EMPTY_STATES, resolveEmptyStateTitle, resolveEmptyStateText, type EmptyStateKey } from './empty-states';

const meta: Meta<typeof EmptyState> = {
  title: 'Stări goale/EmptyState',
  component: EmptyState,
  parameters: { design: '30-stari-goale.md §35a–§35d' },
};
export default meta;
type Story = StoryObj<typeof EmptyState>;

/** Valori de exemplu pentru titlurile/textele catalogului care sunt funcții de parametri. */
const EXAMPLE_PARAMS: Record<string, string> = {
  luna: 'Septembrie 2026',
  data: '24 septembrie',
  an: '2026/2027',
  filiala: 'Centru',
  nefise: '3',
  zi: 'Sâmbătă',
};

function fromCatalog(key: EmptyStateKey): Story {
  const entry = EMPTY_STATES[key];
  const args: EmptyStateProps = {
    variant: entry.variant,
    size: entry.size,
    title: resolveEmptyStateTitle(entry, EXAMPLE_PARAMS),
    description: resolveEmptyStateText(entry, EXAMPLE_PARAMS),
    action: entry.actionLabel ? { label: entry.actionLabel, onClick: fn() } : undefined,
    secondaryAction: entry.secondaryActionLabel ? { label: entry.secondaryActionLabel, onClick: fn() } : undefined,
  };
  return { args };
}

// „Fără rezultate" — căutare/filtre active, are prioritate peste orice cheie din catalog.
export const NoResults: Story = {
  args: {
    variant: 'no-results',
    title: 'Nimic nu se potrivește',
    activeFilters: ['Arhivați', 'Grupa Mars'],
    onClearFilters: fn(),
  },
};

// ── 35b — ecranul principal al modulului ──────────────────────────────────
export const AchitariPeriod: Story = fromCatalog('achitari.period');
export const PrezentaWeekend: Story = fromCatalog('prezenta.weekend');
export const GrupeFirst: Story = fromCatalog('grupe.first');
export const PersonalFirst: Story = fromCatalog('personal.first');
export const ViziteFirst: Story = fromCatalog('vizite.first');
export const BazinFirst: Story = fromCatalog('bazin.first');
export const SituatiaDone: Story = fromCatalog('situatia.done');
export const DenotificatDone: Story = fromCatalog('denotificat.done');
export const SmsFirst: Story = fromCatalog('sms.first');
export const CheltuieliPeriod: Story = fromCatalog('cheltuieli.period');

// ── 35c — pagini, file, panouri ─────────────────────────────────────────────
export const CopiiFirst: Story = fromCatalog('copii.first');
export const DerezolvatDone: Story = fromCatalog('derezolvat.done');
export const AsociereDone: Story = fromCatalog('asociere.done');
export const ConflicteDone: Story = fromCatalog('conflicte.done');
export const TaxeFirst: Story = fromCatalog('taxe.first');
export const TaxeDone: Story = fromCatalog('taxe.done');
export const CandidatiFirst: Story = fromCatalog('candidati.first');
export const IstoricFirst: Story = fromCatalog('istoric.first');
export const ServiciiFirst: Story = fromCatalog('servicii.first');
export const PlanuriFirst: Story = fromCatalog('planuri.first');
export const CursPeriod: Story = fromCatalog('curs.period');
export const ZilenasterePeriod: Story = fromCatalog('zilenastere.period');
export const PrezentaNochildren: Story = fromCatalog('prezenta.nochildren');
export const SituatiaYearPeriod: Story = fromCatalog('situatia.year.period');
export const BazinMonthPeriod: Story = fromCatalog('bazin.month.period');
export const BazinTodayPeriod: Story = fromCatalog('bazin.today.period');
export const RaportPeriod: Story = fromCatalog('raport.period');
export const BonziPeriod: Story = fromCatalog('bonzi.period');

// ── 35d — compact, în interiorul unui card ──────────────────────────────────
export const DashboardAttentionFirst: Story = fromCatalog('dashboard.attention.first');
export const DashboardAttentionDone: Story = fromCatalog('dashboard.attention.done');
export const DashboardBirthdays: Story = fromCatalog('dashboard.birthdays');
export const DashboardVisits: Story = fromCatalog('dashboard.visits');
export const FisaNotes: Story = fromCatalog('fisa.notes');
export const FisaPickup: Story = fromCatalog('fisa.pickup');
export const FisaPayers: Story = fromCatalog('fisa.payers');
export const FisaAbsences: Story = fromCatalog('fisa.absences');
export const GrupeMembers: Story = fromCatalog('grupe.members');
export const GrupePoolDone: Story = fromCatalog('grupe.pool.done');
export const PrezentaMonthGroup: Story = fromCatalog('prezenta.month.group');
export const ViziteDay: Story = fromCatalog('vizite.day');
export const ViziteMonthRest: Story = fromCatalog('vizite.month.rest');
export const CheltuieliCategories: Story = fromCatalog('cheltuieli.categories');
export const BazinCoach: Story = fromCatalog('bazin.coach');
export const RaportIncome: Story = fromCatalog('raport.income');
export const RaportExpenses: Story = fromCatalog('raport.expenses');
export const AsociereSuggestions: Story = fromCatalog('asociere.suggestions');
