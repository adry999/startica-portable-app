# dashboard

Ecranul „Dashboard”: cardurile de încasări ale lunii, alertele de urmărit (de notificat / de verificat / achitări neasociate / vizite programate azi și mâine), istoricul de venituri pe 12 luni și panoul zilelor de naștere. Include și statisticile rezumat de pe ecranul „Copii” (copii activi, grupe ocupate, fișe incomplete), pentru că sunt widget-uri de sumar, nu partea de listă/editare a copiilor.

Modul **independent**: nu importă alt feature. Copiii, plățile și grupele vin din `RecordsSnapshot`; funcțiile de zile de naștere (din `children`) sunt injectate ca parametri, nu importate direct.

## Structură

```
dashboard/
├── README.md
└── domain/
    ├── cash-summary.mjs             # summarizeCashForMonth, sumUnallocatedAdvance
    └── cash-summary.test.mjs
```

## Decizii

- **`sumUnallocatedAdvance`** e funcție pură, separată de `summarizeCashForMonth`.
- **Istoricul de venituri pe 12 luni** reapelează `summarizeCashForMonth` pentru fiecare lună — nu ține un index separat, pentru că fereastra e mică (12 luni) și randarea e o dată pe ciclu.

## Teste

```
node --test "src/features/dashboard/**/*.test.mjs"
```

- Domeniu: `summarizeCashForMonth` (totalizare pe metodă, cheltuieli, filtrare arhivate/altă lună), `sumUnallocatedAdvance` (partea nerepartizată dintr-o plată, filtrare arhivate/dată ulterioară).
