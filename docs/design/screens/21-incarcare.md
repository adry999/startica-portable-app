# 21 — Încărcare

**Referință:** `Incarcare.dc.html#21a–21c`.

## 21a — Pornirea aplicației
- Componentă `app/shell/StartupScreen.tsx`, randată de `AppShell` cât timp sesiunea nu are snapshot-ul.
- Nu se afișează în prima secundă (fundal `--cream` gol). După 1 s: iconița Startica (76 px, animație bounce 1,1 s), logo-ul, bara de progres și lista de pași: Pornesc serverul local · Citesc baza de date · Sincronizez cu serverul comun · Pregătesc Dashboard-ul. Fiecare pas bifat primește durata.
- Pașii vin din evenimente reale ale sesiunii, nu din timer. Pasul de sincronizare lipsește dacă nu e configurat un server.
- Jos: filiala și versiunea.

## 21b — Între pagini
- Meniul și antetul rămân. Sus pe `main`: bară de 3 px, `--orange` pe `--orange-soft`, animație indeterminată.
- Conținutul: schelet (`shared/ui/Skeleton.tsx`) cu forma ecranului țintă: carduri + căutare + 8 rânduri. Gradient `#f1ece2 → #f9f5ee`, 1,4 s.
- **Prag 300 ms:** dacă datele vin mai repede, nu se arată nici bara, nici scheletul. Butonul principal din antet e semitransparent și inactiv cât se încarcă.
- `prefers-reduced-motion`: fără animație, doar gri static.

## 21c — Prea lent (după 15 s)
- Mesaj: „Pornirea durează mai mult ca de obicei”, cu explicația. Butoane: „Lucrez fără legătură” (intră cu datele locale, meniul arată starea offline din 14a) și „Încearcă din nou”. Sub ele, ora ultimei sincronizări.
- Dacă nici baza locală nu se deschide: același ecran, cu textul erorii și „Deschide dosarul cu backupuri”.

## Criterii de acceptare
- [x] O pornire sub 1 s nu arată ecranul 21a
- [x] O navigare sub 300 ms nu clipește
- [ ] 21c apare doar după 15 s și permite lucrul offline — decizie provizorie (INTREBARI.md): fără server comun în această etapă, „Lucrez fără legătură” nu are sens și nu apare; 21c după 15 s arată doar „Încearcă din nou”
