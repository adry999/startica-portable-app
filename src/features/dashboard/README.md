# dashboard

Ecranul „Dashboard”: cardurile de încasări ale lunii, alertele de urmărit (de notificat / de verificat / achitări neasociate / vizite programate azi și mâine), istoricul de venituri pe 12 luni și panoul zilelor de naștere. Include și statisticile rezumat de pe ecranul „Copii” (copii activi, grupe ocupate, fișe incomplete), pentru că sunt widget-uri de sumar, nu partea de listă/editare a copiilor.

Modul **independent**: nu importă alt feature. Copiii, plățile și grupele vin din `RecordsSnapshot`; funcțiile de zile de naștere (din `children`) sunt injectate ca parametri, nu importate direct.

## Public API

### `index.web.mjs`

| Export | Rol |
| --- | --- |
| `createDashboardView({ elements, readRecords, readToday, listUpcomingBirthdays, buildBirthdayCalendar, renderReviewCount, summarizeUpcomingVisits })` | întoarce `renderDashboard({ month, review, evaluations, missingFeeCount })` |
| `createChildrenSummaryView({ elements, readRecords })` | întoarce `renderChildrenSummary({ review })` |

## Cum rămâne decuplat

| Nevoie | Mecanism | Nu |
| --- | --- | --- |
| Calendarul zilelor de naștere, lista celor apropiate | `listUpcomingBirthdays`, `buildBirthdayCalendar` injectate (implementate în `children`) | `import … from '#features/children/…'` |
| Obligația lunară a fiecărui copil (rest de notificat) | parametrul `evaluations`, calculat de apelant cu `billing` | `import … from '#features/billing/…'` |
| Progresul de verificare | parametrul `review`, calculat de apelant cu `review-center` | `import … from '#features/review-center/…'` |
| Vizitele de azi/mâine | `summarizeUpcomingVisits` injectat (implementat în `visits`) | `import … from '#features/visits/…'` |
| Avansul nerepartizat | `sumUnallocatedAdvance` (intern, `domain/cash-summary.mjs`) | recalcul în view |
| Contorul din navigație | `renderReviewCount` injectat | `setNavCount` apelat direct de aici |
| Ziua curentă, instantaneul de date | selectori injectați: `readToday`, `readRecords` | citire din `session` global |

## Structură

```
dashboard/
├── README.md
├── index.web.mjs
├── domain/
│   ├── cash-summary.mjs             # summarizeCashForMonth, sumUnallocatedAdvance
│   └── cash-summary.test.mjs
└── web/
    ├── dashboard.view.mjs           # ★ „Dashboard”
    └── children-summary.view.mjs    # ★ statisticile de pe „Copii”
```

## Decizii

- **`sumUnallocatedAdvance`** e funcție pură, separată de `summarizeCashForMonth`.
- **Istoricul de venituri pe 12 luni** reapelează `summarizeCashForMonth` pentru fiecare lună — nu ține un index separat, pentru că fereastra e mică (12 luni) și randarea e o dată pe ciclu.
- **`evaluations`** primite de `renderDashboard`/`renderChildrenSummary` sunt cele nearhivate, calculate o singură dată de apelant (alături de `billing`) pentru toate ecranele randării curente.

## Teste

```
node --test "src/features/dashboard/**/*.test.mjs"
```

- Domeniu: `summarizeCashForMonth` (totalizare pe metodă, cheltuieli, filtrare arhivate/altă lună), `sumUnallocatedAdvance` (partea nerepartizată dintr-o plată, filtrare arhivate/dată ulterioară).
