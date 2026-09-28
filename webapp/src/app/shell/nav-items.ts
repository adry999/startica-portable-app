import type { ViewKey } from '../../shared/view-key';

export type { ViewKey } from '../../shared/view-key';

export type NavMarkerColor = 'yellow' | 'mint' | 'pink' | 'grey';

export interface NavItem {
  view: ViewKey;
  label: string;
}

export interface NavGroup {
  title: string | null;
  marker: NavMarkerColor;
  items: NavItem[];
}

/** Grupare și etichete din README-ul redesign-ului, secțiunea Sidebar. */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: null,
    marker: 'yellow',
    items: [
      { view: 'dashboard', label: 'Dashboard' },
      { view: 'children', label: 'Copii' },
      { view: 'groups', label: 'Grupe' },
      { view: 'attendance', label: 'Prezența' },
      { view: 'visits', label: 'Vizite' },
      { view: 'personal', label: 'Personal' },
    ],
  },
  {
    title: 'Contabilitate',
    marker: 'mint',
    items: [
      { view: 'payments', label: 'Achitări' },
      { view: 'expenses', label: 'Cheltuieli' },
      { view: 'status', label: 'Situația plăților' },
      { view: 'notify', label: 'De notificat' },
      { view: 'report', label: 'Raport contabil' },
    ],
  },
  {
    title: 'De rezolvat',
    marker: 'pink',
    items: [
      { view: 'fees', label: 'Taxe și grupe' },
      { view: 'review', label: 'De verificat' },
      { view: 'assign', label: 'Asociere achitări' },
      { view: 'conflicts', label: 'Conflicte' },
    ],
  },
  {
    title: 'Administrare',
    marker: 'grey',
    items: [
      { view: 'audit', label: 'Istoric' },
      { view: 'notifications', label: 'Notificări' },
      { view: 'settings', label: 'Backup și setări' },
    ],
  },
];

/** Eyebrow + titlu pentru topbar, câte unul per ecran. */
export const VIEW_TITLES: Record<ViewKey, { eyebrow: string; title: string }> = {
  dashboard: { eyebrow: 'Privire de ansamblu', title: 'Rezumatul lunii' },
  children: { eyebrow: 'Evidență', title: 'Copii' },
  groups: { eyebrow: 'Organizare', title: 'Grupe' },
  attendance: { eyebrow: 'Evidență', title: 'Prezența' },
  visits: { eyebrow: 'Înscrieri', title: 'Vizite' },
  personal: { eyebrow: 'Evidență', title: 'Personal' },
  payments: { eyebrow: 'Contabilitate', title: 'Achitări' },
  expenses: { eyebrow: 'Contabilitate', title: 'Cheltuieli' },
  status: { eyebrow: 'Contabilitate', title: 'Situația plăților' },
  notify: { eyebrow: 'Contabilitate', title: 'De notificat' },
  report: { eyebrow: 'Contabilitate', title: 'Raport contabil' },
  fees: { eyebrow: 'De rezolvat', title: 'Taxe și grupe' },
  review: { eyebrow: 'De rezolvat', title: 'De verificat' },
  assign: { eyebrow: 'De rezolvat', title: 'Asociere achitări' },
  conflicts: { eyebrow: 'De rezolvat', title: 'Conflicte' },
  audit: { eyebrow: 'Administrare', title: 'Istoric' },
  notifications: { eyebrow: 'Administrare', title: 'Notificări' },
  settings: { eyebrow: 'Administrare', title: 'Backup și setări' },
};
