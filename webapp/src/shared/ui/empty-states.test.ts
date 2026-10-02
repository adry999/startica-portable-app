import { describe, expect, it } from 'vitest';
import { EMPTY_STATES, resolveEmptyStateText, resolveEmptyStateTitle, type EmptyStateKey } from './empty-states';

const SAMPLE_PARAMS = {
  luna: 'septembrie',
  zi: 'Sâmbătă',
  data: '12.09.2026',
  an: '2026/2027',
  filiala: 'Filiala 1',
  modul: 'Achitările',
  profil: 'Educator',
};

// docs/design/screens/30-stari-goale.md §35b–§35d — fiecare cheie trebuie să existe în catalog.
const KEYS_35B: EmptyStateKey[] = [
  'achitari.period',
  'prezenta.weekend',
  'grupe.first',
  'personal.first',
  'vizite.first',
  'bazin.first',
  'situatia.done',
  'denotificat.done',
  'sms.first',
  'cheltuieli.period',
];

const KEYS_35C: EmptyStateKey[] = [
  'copii.first',
  'derezolvat.done',
  'asociere.done',
  'conflicte.done',
  'taxe.first',
  'taxe.done',
  'candidati.first',
  'istoric.first',
  'servicii.first',
  'planuri.first',
  'curs.period',
  'zilenastere.period',
  'prezenta.nochildren',
  'situatia.year.period',
  'bazin.month.period',
  'bazin.today.period',
  'raport.period',
  'bonzi.period',
];

const KEYS_35D: EmptyStateKey[] = [
  'dashboard.revenue.first',
  'dashboard.attention.first',
  'dashboard.attention.done',
  'dashboard.birthdays',
  'dashboard.visits',
  'fisa.notes',
  'fisa.pickup',
  'fisa.payers',
  'fisa.absences',
  'grupe.members',
  'grupe.pool.done',
  'prezenta.month.group',
  'vizite.day',
  'vizite.month.rest',
  'cheltuieli.categories',
  'bazin.coach',
  'raport.income',
  'raport.expenses',
  'asociere.suggestions',
  'planuri.childForm',
  'backup.first',
];

// 36f — modul neinclus în profilul calculatorului (31-profiluri-calculator.md).
const KEYS_36: EmptyStateKey[] = ['profil.blocked'];

describe('empty-states', () => {
  it('fiecare cheie din 35b are un titlu nevid și o variantă validă', () => {
    for (const key of KEYS_35B) {
      const entry = EMPTY_STATES[key];
      expect(entry, `cheia ${key}`).toBeDefined();
      expect(resolveEmptyStateTitle(entry, SAMPLE_PARAMS), `cheia ${key}`).not.toHaveLength(0);
      expect(['first', 'done', 'period']).toContain(entry.variant);
      expect(entry.size, `cheia ${key} nu e compact`).toBeUndefined();
    }
  });

  it('fiecare cheie din 35c există, cu titlu nevid și fără size="compact"', () => {
    for (const key of KEYS_35C) {
      const entry = EMPTY_STATES[key];
      expect(entry, `cheia ${key}`).toBeDefined();
      expect(resolveEmptyStateTitle(entry, SAMPLE_PARAMS), `cheia ${key}`).not.toHaveLength(0);
      expect(entry.size, `cheia ${key} nu e compact`).toBeUndefined();
    }
  });

  it('fiecare cheie din 35d există, cu size="compact" și titlu nevid', () => {
    for (const key of KEYS_35D) {
      const entry = EMPTY_STATES[key];
      expect(entry, `cheia ${key}`).toBeDefined();
      expect(entry.size, `cheia ${key} e compact`).toBe('compact');
      expect(resolveEmptyStateTitle(entry, SAMPLE_PARAMS), `cheia ${key}`).not.toHaveLength(0);
    }
  });

  it('fiecare cheie din 36f există, cu titlu și text nevide, fără size="compact"', () => {
    for (const key of KEYS_36) {
      const entry = EMPTY_STATES[key];
      expect(entry, `cheia ${key}`).toBeDefined();
      expect(resolveEmptyStateTitle(entry, SAMPLE_PARAMS), `cheia ${key}`).not.toHaveLength(0);
      expect(resolveEmptyStateText(entry, SAMPLE_PARAMS), `cheia ${key}`).not.toHaveLength(0);
      expect(entry.size, `cheia ${key} nu e compact`).toBeUndefined();
    }
  });

  it('catalogul nu are alte chei în afara celor din 35b+35c+35d+36f', () => {
    const expected = new Set([...KEYS_35B, ...KEYS_35C, ...KEYS_35D, ...KEYS_36]);
    expect(Object.keys(EMPTY_STATES).sort()).toEqual([...expected].sort());
  });

  it('profil.blocked interpolează modulul și profilul curent', () => {
    expect(resolveEmptyStateTitle(EMPTY_STATES['profil.blocked'], { modul: 'Achitările' })).toBe(
      'Acest calculator nu are acces la Achitările',
    );
    expect(resolveEmptyStateText(EMPTY_STATES['profil.blocked'], { profil: 'Educator' })).toBe(
      'Calculatorul are profilul Educator. Accesul se schimbă din Sincronizare, de pe un calculator cu profil Complet.',
    );
  });

  it('interpolează parametrii în titlurile care depind de ei', () => {
    expect(resolveEmptyStateTitle(EMPTY_STATES['achitari.period'], { luna: 'octombrie' })).toBe(
      'Nicio achitare în octombrie',
    );
    expect(resolveEmptyStateTitle(EMPTY_STATES['situatia.done'], { luna: 'octombrie' })).toBe(
      'Toți au achitat octombrie',
    );
    expect(resolveEmptyStateTitle(EMPTY_STATES['copii.first'], { filiala: 'Filiala Nord' })).toBe(
      'Încă nu e niciun copil în Filiala Nord',
    );
  });

  it('folosește un fallback rezonabil când parametrii lipsesc', () => {
    expect(resolveEmptyStateTitle(EMPTY_STATES['cheltuieli.period'])).toBe('Nicio cheltuială în luna aleasă');
  });

  it('titlurile fixe (fără parametri) rămân neschimbate', () => {
    expect(resolveEmptyStateTitle(EMPTY_STATES['grupe.first'])).toBe('Nicio grupă încă');
  });

  it('resolveEmptyStateText întoarce paragraful de sub titlu, sau undefined pe cheile compact', () => {
    expect(resolveEmptyStateText(EMPTY_STATES['grupe.first'])).toBe(
      'Creează grupele cu vârsta și capacitatea lor, apoi trage copiii în ele.',
    );
    expect(resolveEmptyStateText(EMPTY_STATES['fisa.notes'])).toBeUndefined();
  });

  it('copii.first are buton secundar „Din vizitele programate” (35a)', () => {
    expect(EMPTY_STATES['copii.first'].secondaryActionLabel).toBe('Din vizitele programate');
  });
});
