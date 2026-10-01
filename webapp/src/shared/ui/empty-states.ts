/**
 * Catalogul textelor pentru stările goale (docs/design/screens/30-stari-goale.md §35a–§35d) —
 * ecranele dau doar `empty="<cheie>"` (prin `DataTable`/`EmptyState`), textul stă aici, nu în
 * `features/` (R9, DS-IMPLEMENTARE.md §1). „Fără rezultate" (căutare/filtre active) NU e în acest
 * catalog — are prioritate peste orice cheie și textul ei e generic, generat direct de consumator.
 *
 * §35a/§35b — variantele mari, pe ecranul principal al modulului.
 * §35c — variantele mari, în pagini/file/panouri secundare.
 * §35d — varianta `size="compact"`, un rând în interiorul unui card cu titlu propriu.
 */

export type EmptyStateKey =
  // 35b — ecranul principal al modulului
  | 'achitari.period'
  | 'prezenta.weekend'
  | 'grupe.first'
  | 'personal.first'
  | 'vizite.first'
  | 'bazin.first'
  | 'situatia.done'
  | 'denotificat.done'
  | 'sms.first'
  | 'cheltuieli.period'
  // 35c — pagini, file, panouri
  | 'copii.first'
  | 'derezolvat.done'
  | 'asociere.done'
  | 'conflicte.done'
  | 'taxe.first'
  | 'candidati.first'
  | 'istoric.first'
  | 'servicii.first'
  | 'planuri.first'
  | 'curs.period'
  | 'zilenastere.period'
  | 'prezenta.nochildren'
  | 'situatia.year.period'
  | 'bazin.month.period'
  | 'raport.period'
  | 'bonzi.period'
  // 35d — compact, în interiorul unui card
  | 'dashboard.attention.first'
  | 'dashboard.attention.done'
  | 'dashboard.birthdays'
  | 'dashboard.visits'
  | 'fisa.notes'
  | 'fisa.pickup'
  | 'fisa.payers'
  | 'fisa.absences'
  | 'grupe.members'
  | 'grupe.pool.done'
  | 'prezenta.month.group'
  | 'vizite.day'
  | 'vizite.month.rest'
  | 'cheltuieli.categories'
  | 'bazin.coach'
  | 'raport.income'
  | 'raport.expenses'
  | 'asociere.suggestions';

type CatalogText = string | ((params: Record<string, string>) => string);

export interface EmptyStateCatalogEntry {
  variant: 'first' | 'done' | 'period';
  /** Titlul (sau, pe cheile `size="compact"` din 35d, singurul rând de text arătat). */
  title: CatalogText;
  /** Paragraful de sub titlu — lipsă pe cheile 35d (compact n-are titlu separat de text). */
  text?: CatalogText;
  /** Marchează cheile din 35d — randate cu `EmptyState size="compact"`, nu cu decorul variantei. */
  size?: 'compact';
  actionLabel?: string;
  /** Doar `copii.first` (35a) — „Din vizitele programate”, arătat doar dacă există vizite programate. */
  secondaryActionLabel?: string;
}

export const EMPTY_STATES: Record<EmptyStateKey, EmptyStateCatalogEntry> = {
  // ── 35b — ecranul principal al modulului ──────────────────────────────
  'achitari.period': {
    variant: 'period',
    title: params => `Nicio achitare în ${params.luna ?? 'luna aleasă'}`,
    text: 'Achitările lunii apar aici pe măsură ce le înregistrezi.',
    actionLabel: '+ Achitare nouă',
  },
  'prezenta.weekend': {
    variant: 'period',
    title: params => `${params.zi ?? 'Zi liberă'}, ${params.data ?? ''}`.trim(),
    text: 'Grădinița nu lucrează în weekend. Alege o zi lucrătoare din calendar.',
  },
  'grupe.first': {
    variant: 'first',
    title: 'Nicio grupă încă',
    text: 'Creează grupele cu vârsta și capacitatea lor, apoi trage copiii în ele.',
    actionLabel: '+ Grupă nouă',
  },
  'personal.first': {
    variant: 'first',
    title: 'Niciun angajat adăugat',
    text: 'Adaugă angajații ca să poți face pontajul și salariile.',
    actionLabel: '+ Angajat nou',
  },
  'vizite.first': {
    variant: 'first',
    title: 'Nicio vizită programată',
    text: 'Programează vizitele părinților interesați. Din vizită poți face apoi fișa copilului.',
    actionLabel: '+ Programează vizită',
  },
  'bazin.first': {
    variant: 'first',
    title: 'Niciun copil la bazin',
    text: 'Înscrie copiii la bazin din fișa lor sau de aici.',
    actionLabel: '+ Înscrie la bazin',
  },
  'situatia.done': {
    variant: 'done',
    title: params => `Toți au achitat ${params.luna ?? 'luna aleasă'}`,
    text: 'Nicio restanță în filială. Luna următoare apare pe 1 octombrie.',
  },
  'denotificat.done': {
    variant: 'done',
    title: 'Nimeni de notificat',
    // `nefise` (PROMPT-CLAUDE-CODE-6.md §2) — numărul de fișe „De verificat” care nu pot fi
    // evaluate încă (fără taxă/perioadă confirmată); informație de business reală, nu doar decor.
    text: params =>
      Number(params.nefise ?? '0') > 0
        ? `${params.nefise} fișe nu pot fi evaluate. Completează taxa și perioada.`
        : 'Toți părinții cu restanțe au primit SMS. Lista se completează după scadență.',
  },
  'sms.first': {
    variant: 'first',
    title: 'Niciun SMS trimis',
    text: 'Mesajele trimise din Situația plăților sau cu „+ SMS nou” apar aici, cu starea de livrare.',
    actionLabel: '+ SMS nou',
  },
  'cheltuieli.period': {
    variant: 'period',
    title: params => `Nicio cheltuială în ${params.luna ?? 'luna aleasă'}`,
    text: 'Cheltuielile lunii apar aici pe măsură ce le înregistrezi.',
    actionLabel: '+ Cheltuială nouă',
  },

  // ── 35c — pagini, file, panouri ────────────────────────────────────────
  'copii.first': {
    variant: 'first',
    title: params => `Încă nu e niciun copil în ${params.filiala ?? 'filiala curentă'}`,
    text: 'Adaugă primul copil cu datele părinților și contractul. După asta apar grupele, prezența și taxele lui.',
    actionLabel: '+ Copil nou',
    secondaryActionLabel: 'Din vizitele programate',
  },
  'derezolvat.done': {
    variant: 'done',
    title: 'Nimic de rezolvat',
    text: 'Taxele, verificările și asocierile sunt la zi.',
  },
  'asociere.done': {
    variant: 'done',
    title: 'Toate achitările sunt asociate',
    text: 'Achitările noi din extras apar aici până le legi de un copil.',
  },
  'conflicte.done': {
    variant: 'done',
    title: 'Niciun conflict',
    text: 'Modificările de pe celelalte calculatoare s-au unit fără probleme.',
  },
  'taxe.first': {
    variant: 'first',
    title: 'Niciun copil activ',
    text: 'Taxele se completează după ce adaugi copii.',
    actionLabel: '+ Copil nou',
  },
  'candidati.first': {
    variant: 'first',
    title: 'Niciun candidat încă',
    text: 'Ține aici persoanele cu care ai vorbit pentru un post.',
    actionLabel: '+ Candidat',
  },
  'istoric.first': {
    variant: 'first',
    title: 'Nicio modificare înregistrată',
    text: 'Tot ce se adaugă, se editează sau se șterge apare aici, cu ora și calculatorul.',
  },
  'servicii.first': {
    variant: 'first',
    title: 'Niciun serviciu încă',
    text: 'Adaugă serviciile plătite separat de taxă, de exemplu bazinul.',
    actionLabel: '+ Serviciu nou',
  },
  'planuri.first': {
    variant: 'first',
    title: 'Niciun plan adăugat',
    text: 'Planurile în euro se aleg apoi la contractul copilului.',
    actionLabel: '+ Plan',
  },
  'curs.period': {
    variant: 'period',
    title: 'Niciun curs înregistrat',
    text: 'Cursul BNM se descarcă singur la pornire, când e internet.',
    actionLabel: 'Descarcă acum',
  },
  'zilenastere.period': {
    variant: 'period',
    title: params => `Nicio zi de naștere în ${params.luna ?? 'luna aleasă'}`,
    text: 'Alege altă lună din antet.',
  },
  'prezenta.nochildren': {
    variant: 'period',
    title: params => `Niciun copil înscris pe ${params.data ?? 'data aleasă'}`,
    text: 'Copiii apar aici din ziua în care le începe contractul.',
  },
  'situatia.year.period': {
    variant: 'period',
    title: params => `Niciun copil cu taxă în ${params.an ?? 'anul ales'}`,
    text: 'Harta apare după ce copiii au o taxă în anul școlar ales.',
  },
  'bazin.month.period': {
    variant: 'period',
    title: params => `Nicio programare în ${params.luna ?? 'luna aleasă'}`,
    text: 'Programările făcute în Săptămâna apar aici, cu totalul pe copil.',
  },
  'raport.period': {
    variant: 'period',
    title: 'Nicio mișcare în perioada aleasă',
    text: 'Alege altă perioadă din antet.',
  },
  'bonzi.period': {
    variant: 'period',
    title: params => `Nicio achitare pe ${params.data ?? 'data aleasă'}`,
    text: 'Bonul se tipărește doar pentru zile cu încasări.',
  },

  // ── 35d — compact, în interiorul unui card ──────────────────────────────
  // Niciun copil în filială încă — nu o coadă de atenție goală din lipsă de probleme, ci din
  // lipsă de date (PROMPT-CLAUDE-CODE-6.md §2).
  'dashboard.attention.first': {
    variant: 'first',
    size: 'compact',
    title: 'Adaugă primii copii',
    actionLabel: 'Copil nou',
  },
  'dashboard.attention.done': {
    variant: 'done',
    size: 'compact',
    title: 'Nimic de rezolvat azi.',
  },
  'dashboard.birthdays': {
    variant: 'period',
    size: 'compact',
    title: 'Nicio zi de naștere în următoarele 5 zile.',
  },
  'dashboard.visits': {
    variant: 'period',
    size: 'compact',
    title: 'Nicio vizită azi sau mâine.',
    actionLabel: 'Programează',
  },
  'fisa.notes': {
    variant: 'first',
    size: 'compact',
    title: 'Nicio notă încă.',
    actionLabel: '+ Notă',
  },
  'fisa.pickup': {
    variant: 'first',
    size: 'compact',
    title: 'Nicio persoană adăugată.',
    actionLabel: '+ Adaugă',
  },
  'fisa.payers': {
    variant: 'first',
    size: 'compact',
    title: 'Niciun plătitor reținut. Se adaugă când bifezi „Ține minte plătitorul” la',
    actionLabel: 'Asociere achitări',
  },
  'fisa.absences': {
    variant: 'period',
    size: 'compact',
    title: params => `Nicio absență motivată în ${params.luna ?? 'luna aleasă'}.`,
  },
  'grupe.members': {
    variant: 'first',
    size: 'compact',
    title: 'Niciun copil în grupă. Caută mai sus sau trage-i din Tablă.',
  },
  'grupe.pool.done': {
    variant: 'done',
    size: 'compact',
    title: 'Toți copiii au grupă.',
  },
  'prezenta.month.group': {
    variant: 'period',
    size: 'compact',
    title: 'Niciun copil în această grupă.',
  },
  'vizite.day': {
    variant: 'period',
    size: 'compact',
    title: 'Nicio vizită în această zi.',
    actionLabel: '+ Programează',
  },
  'vizite.month.rest': {
    variant: 'period',
    size: 'compact',
    title: 'Nicio altă vizită luna aceasta.',
  },
  'cheltuieli.categories': {
    variant: 'first',
    size: 'compact',
    title: 'Nicio categorie proprie. Se folosesc cele implicite.',
    actionLabel: '+ Categorie',
  },
  'bazin.coach': {
    variant: 'first',
    size: 'compact',
    title: 'Niciun antrenor. Adaugă-l în',
    actionLabel: 'Personal',
  },
  'raport.income': {
    variant: 'period',
    size: 'compact',
    title: 'Nicio încasare în perioada aleasă.',
  },
  'raport.expenses': {
    variant: 'period',
    size: 'compact',
    title: 'Nicio cheltuială în perioada aleasă.',
  },
  'asociere.suggestions': {
    variant: 'first',
    size: 'compact',
    title: 'Nicio sugestie. Caută copilul mai jos.',
  },
};

function resolveText(value: CatalogText | undefined, params: Record<string, string>): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'function' ? value(params) : value;
}

export function resolveEmptyStateTitle(entry: EmptyStateCatalogEntry, params?: Record<string, string>): string {
  return resolveText(entry.title, params ?? {}) ?? '';
}

export function resolveEmptyStateText(
  entry: EmptyStateCatalogEntry,
  params?: Record<string, string>,
): string | undefined {
  return resolveText(entry.text, params ?? {});
}
