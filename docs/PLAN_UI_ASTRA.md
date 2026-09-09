# Plan UI Startica — Astra / Terra

Plan elaborat cu Astra, implementare delegată agenților Terra. Aplicația rămâne locală; păstrăm datele, calculele și designul Startica existent.

## Lucrări și criterii de acceptare

1. **Navigare grupată.** Operațiuni: Copii, Achitări, Cheltuieli, De notificat, Asociere achitări. Rapoarte: Dashboard, Situația plăților. Administrare: Taxe și grupe, Grupe, De verificat, Istoric, Backup și setări. Fiecare destinație apare o singură dată, cu contoarele existente și pagina curentă marcată.
2. **Starea aplicației.** Salvarea și backupul apar într-un rând secundar în antet. Stările normale sunt discrete; modificările nesalvate, erorile și avertizările rămân lizibile. Prioritatea erorilor și logica confirmării salvării nu se schimbă.
3. **Indicatori lunari și cumulați.** Încasările, cheltuielile și diferența formează rezumatul lunii. Avansurile nerepartizate au o zonă separată, etichetată „Toate lunile, până azi”. Schimbarea lunii nu modifică avansul dacă datele sunt aceleași.
4. **Situații fără probleme.** Rândurile cu zero din „Necesită atenție” au text și stil neutru. Mesajul general pozitiv apare numai dacă toate cele trei categorii au zero. Categoriile nu se însumează, deoarece se suprapun.
5. **Filtre uniforme.** Copii, Achitări, Cheltuieli și Centrul de verificare folosesc aceeași structură vizuală pentru căutare și filtre. Păstrăm semantica filtrelor și resetarea paginării. Barele de editare în masă rămân distincte.
6. **Rezumat Copii.** „Copii cu statut Activ” numără fișele nearhivate cu statutul curent Activ. „Grupe ocupate” numără grupele distincte, ne-goale, ale copiilor nearhivați. „Fișe de verificat” folosește înregistrările unice din centrul de verificare. Rezumatul este independent de filtre și luna financiară. Pagina Grupe folosește aceeași populație nearhivată.
7. **Navigare mobilă.** La maximum 720 px, un buton afișează sau ascunde meniul grupat. Alegerea paginii și Escape îl închid; desktopul păstrează meniul vizibil. Selectorul personalizat de lună rămâne funcțional.

## Împărțirea implementării

- Terra — structură: `web/index.html`.
- Terra — aspect și adaptare: `web/app.css`.
- Terra — comportamente: `web/app.js`, `web/ui/views.mjs`, după finalizarea structurii.
- Agent principal — integrare, revizie și verificări.

Fișierele cu modificări existente se editează incremental. Nu se schimbă backendul, baza de date, dependențele sau publicarea aplicației.

## Verificare

- Verificări de sintaxă și diferențe fără erori de spațiere.
- Suita existentă de teste pentru regresii.
- Testul browser izolat: navigare, selector lună, filtre, rezumate, salvare și recuperare după eroare. Folosește numai date temporare.
- Verificarea încadrării la 1440, 1024 și 390 px, inclusiv revenirea de la mobil la desktop.

Limitările de mediu sau verificările care nu pot fi finalizate vor fi raportate separat de rezultatele confirmate.

## Rezultat

Cele șapte îmbunătățiri sunt implementate. Astra a făcut planul și revizia structurii/stilurilor; doi agenți Terra au realizat structura, stilurile și comportamentele, iar agentul principal a integrat corecțiile și verificările.

Confirmat: 29 de teste existente trecute, testul browser extins trecut și capturi verificate la 1440, 1024 și 390 px. Testele browser includ meniul mobil și revenirea la desktop, selectarea lunii, lipsa depășirii orizontale, separarea avansurilor de luna selectată, rezumatul independent de filtre, excluderea fișelor arhivate din grupe și păstrarea avertizărilor când există fișe de verificat. Baza reală nu a fost modificată.
