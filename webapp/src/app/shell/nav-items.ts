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
      { view: 'visits', label: 'Vizite' },
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
    ],
  },
  {
    title: 'De rezolvat',
    marker: 'pink',
    items: [
      { view: 'fees', label: 'Taxe și grupe' },
      { view: 'review', label: 'De verificat' },
      { view: 'assign', label: 'Asociere achitări' },
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
  groups: { eyebrow: 'Administrare', title: 'Grupe' },
  visits: { eyebrow: 'Înscrieri', title: 'Vizite' },
  payments: { eyebrow: 'Contabilitate', title: 'Achitări' },
  expenses: { eyebrow: 'Contabilitate', title: 'Cheltuieli' },
  status: { eyebrow: 'Contabilitate', title: 'Situația plăților' },
  notify: { eyebrow: 'Contabilitate', title: 'De notificat' },
  fees: { eyebrow: 'De rezolvat', title: 'Taxe și grupe' },
  review: { eyebrow: 'De rezolvat', title: 'De verificat' },
  assign: { eyebrow: 'De rezolvat', title: 'Asociere achitări' },
  audit: { eyebrow: 'Administrare', title: 'Istoric' },
  notifications: { eyebrow: 'Administrare', title: 'Notificări' },
  settings: { eyebrow: 'Administrare', title: 'Backup și setări' },
};
