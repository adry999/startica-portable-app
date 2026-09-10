# Startica — utilizare locală

Pornește din scurtătura **Startica** (sau `Porneste_Startica.vbs`): Startica se deschide într-o fereastră proprie Chrome/Edge, fără taburi și bară de adrese. Serverul local rulează ascuns în fundal. Este necesar Node.js cu suport `node:sqlite` (versiunea instalată pe acest calculator este compatibilă). Pornirile ulterioare folosesc serverul deja pornit pentru această copie a aplicației.

La închiderea ultimei ferestre Startica pornite prin noul lansator, serverul se oprește automat și încearcă un backup final. `Opreste_Startica.vbs` rămâne o opțiune de rezervă dacă supravegherea ferestrei nu funcționează. Înainte să închizi, așteaptă confirmarea salvării. Formularele modificate și salvările neconfirmate declanșează avertizarea browserului la închidere.

Fereastra Startica folosește un profil de browser separat, fără acces la taburile și extensiile personale Chrome. Profilul se află în `%LOCALAPPDATA%\Startica`, nu în folderul aplicației: conține cookies și date de autentificare, iar folderul aplicației este copiat și arhivat. Conține preferințe și cache pentru interfață, nu baza evidenței; poate fi șters oricând, se recreează la pornire. Vechiul folder `Interfata` din aplicație nu mai este folosit și poate fi șters. Dacă sunt deschise două ferestre Startica, serverul rămâne pornit până la închiderea ultimei. O oprire forțată a Windows poate împiedica backupul final; fiecare salvare confirmată este deja scrisă în SQLite. Erorile de pornire se găsesc în `Jurnale`.

Aceasta este interfața locală afișată în modul aplicație al Chrome/Edge, nu un program Windows nativ instalat. Datele rămân în SQLite pe calculator. Pentru depanare, aceeași interfață poate fi accesată la http://127.0.0.1:8765.

Poți porni și din scurtătura `Startica.lnk`, cu pictograma oficială. O poți copia pe Desktop. Logo-ul și pictograma sunt în `assets`, preluate de pe startica.md. Culorile și fonturile existente corespund paletei site-ului.

După această actualizare, închide ferestrele Startica vechi, rulează o singură dată `Opreste_Startica.vbs`, apoi pornește din nou. Oprirea automată urmărește numai ferestrele create cu noul lansator, nu taburile obișnuite sau ferestrele vechi.

## Ce este unde

    Porneste_Startica.vbs / .cmd   lansatoare
    startica_desktop.ps1           lansatorul propriu-zis: pornește serverul și fereastra
    startica_server.mjs            punctul de intrare al serverului
    shared/                        reguli comune, aceleași în browser și pe server
    server/                        bază de date, backup, rute, verificări
    web/                           tot ce ajunge în browser: pagina, stilurile, ecranele
    tests/  scripts/               teste și unelte de întreținere
    Startica_Date/                 baza de evidență
    Startica_Backup/  Jurnale/     copii de siguranță și jurnale de pornire

Profilul de browser nu mai stă aici, ci în `%LOCALAPPDATA%\Startica`.

În `web/ui`, `views.mjs` coordonează randarea și registrele, iar ecranele sunt separate în `reports.mjs` (dashboard, calendar și situația plăților), `groups-categories.mjs`, `review.mjs` și `profile-audit.mjs`. Funcțiile comune acestor ecrane sunt în `view-helpers.mjs`.

## Cum pornește

Scurtătura pornește prin `wscript.exe`, care nu are consolă: nu apare nicio fereastră neagră, nici măcar pentru o clipă. Fișierele `.cmd` fac același lucru, dar deschid scurt o fereastră de consolă; rămân ca variantă de rezervă și pentru diagnostic.

Dacă muți scurtătura pe Desktop, copiaz-o din nou după actualizări: ținta ei s-a schimbat.

## Date și copii

- Baza: `Startica_Date/startica.db`. Nu șterge și nu muta fișierele bazei cât aplicația rulează.
- Backupuri: `Startica_Backup`. Copiile SQLite sunt create consecvent și verificate înainte de utilizare. Nu copia doar fișierul `.db` al unei baze deschise; folosește butonul Backup.
- La prima pornire după actualizare, baza veche este copiată înaintea migrării. Datele sunt apoi păstrate ca înregistrări separate, cu chei unice. Jurnalul vechi este păstrat; noul ecran Istoric prezintă modificările din versiunea nouă.
- Retenție locală: ultimele 20 de copii, câte una pentru ultimele 30 de zile distincte cu backup și 12 luni distincte cu backup. Copiile anterioare importului, restaurării și migrării sunt exceptate de la ștergerea automată. Acestea și copiile externe trebuie revizuite periodic pentru spațiu disponibil.
- În „Backup și setări”, introdu calea completă a unui folder Google Drive existent. Se creează și se verifică o copie de probă. Nu plasa baza activă în folderul sincronizat.
- Indicatorul aplicației confirmă copia locală și fișierul din destinația externă, nu încărcarea în cloud. Verifică sincronizarea în Google Drive. Dacă folderul extern dispare sau discul este plin, salvarea reușită a datelor este afișată separat de eroarea de backup.
- Un backup local și unul în Google Drive reduc riscul, dar nu garantează imposibilitatea pierderii datelor. Testează periodic restaurarea într-o copie a aplicației.

## Salvare

Indicatorul din dreapta sus apare pe toate paginile: verde = date confirmate pe disc; galben = formular/setări nesalvate, încărcare sau salvare în curs; roșu = eroare de salvare, conexiune sau backup. Textul explică problema; la trecerea mouse-ului apare ultima salvare confirmată. Conexiunea este verificată și la revenirea în fereastră, respectiv la fiecare 30 de secunde. Verde nu confirmă sincronizarea Google Drive; verifică separat aplicația Drive.

Formularele se salvează prin butonul Salvează, nu automat la tastare. Închiderea unui formular fără salvare abandonează modificările lui. După o eroare de conexiune, indicatorul rămâne roșu până la verificare/reîncercare. Setările nesalvate sunt păstrate în formular la verificările conexiunii.

Lansatoarele CMD pornesc acum controlerul ascuns și se termină imediat. La dublu clic, terminalul lansatorului dispare; într-un PowerShell deja deschis revine promptul, fără a închide terminalul tău. Scurtătura Startica.lnk pornește direct aplicația fără terminal. Închiderea ultimei ferestre păstrează mecanismul de oprire automată cu backup final.

Datele devin curente în pagină după confirmarea serverului. Reîncercarea aceleiași operațiuni nu adaugă o plată nouă. După întreruperea conexiunii, „Reîncarcă datele” verifică/reia aceeași operațiune; celelalte salvări rămân blocate până la clarificare.

Dacă două file au date diferite, salvarea din fila veche este refuzată. Reîncarcă datele și redeschide înregistrarea înainte să aplici modificarea. Datele de formular neconfirmate se pot pierde dacă închizi definitiv browserul; verifică mai întâi starea înregistrării înainte să o introduci din nou.

## Taxe, plăți și restanțe

Fișa copilului permite două nume de părinți și două telefoane, toate opționale. Contactul vechi rămâne Părinte 1 / Telefon 1; nu se pierde la actualizare. Ambele contacte apar în registru, fișa copilului, căutare și exportul Excel complet. Importul nu separă automat nume ambigue dintr-o singură celulă.

O achitare poate conține Cash, Card și Transfer simultan. Completează sumele dorite; gol înseamnă zero. Totalul se calculează automat și trebuie să fie pozitiv. Exemplu: Cash 1000 + Card 500 = o singură achitare de 1500 lei. Repartizarea pe luni se face din total, nu separat pentru fiecare metodă. Dashboardul arată atât totalul lunar, cât și încasările pe metode; exportul include coloane Cash, Card, Transfer. Plățile vechi cu o singură metodă rămân compatibile; metodele istorice necunoscute sunt afișate separat, fără a inventa împărțirea.

- Încasările din dashboard sunt după **data încasării**; obligațiile copilului sunt după **luna repartizării**.
- Într-o achitare poți adăuga mai multe luni. Suma repartizată nu poate depăși suma încasată. Diferența este avans nerepartizat; nu se scade automat dintr-o datorie.
- Completează începutul frecventării și istoricul taxei. O taxă fără dată de aplicare nu este extinsă automat în trecut.
- Istoricul acceptă câte un rând `2026-09 = 2000` pentru taxă și `2026-09 = Activ` pentru statut. Statutele disponibile sunt Activ, Suspendat, Retras. Modificările sunt lunare.
- Regula implementată: taxă integrală pentru luna începută, inclusiv luna retragerii, dacă statutul acelei luni rămâne Activ. Nu există calcul proporțional pe zile sau reducere pentru absențe. Un statut Retras/Suspendat aplicat dintr-o lună elimină obligația acelei luni.
- Restanța apare după ziua scadentă. Pentru scadența 31 într-o lună mai scurtă, se folosește ultima zi a lunii.
- Plățile datate după ziua curentă sunt excluse din soldul copilului la zi.
- Informațiile insuficiente apar „De verificat”. Nu folosi aceste rânduri pentru solicitarea unei sume până la completare.
- Lista „De notificat” include obligațiile cunoscute cu rest de plată pentru luna selectată, inclusiv înaintea scadenței. Fișele fără taxă aplicabilă, început de frecventare sau statut confirmat sunt excluse și contorizate separat ca neevaluabile. O taxă explicită de zero nu generează notificare.
- Arhivarea copilului îl ascunde din registrul curent; păstrează obligațiile istorice. Arhivarea unei plăți/cheltuieli o exclude din rapoarte și este consemnată în istoric. În filtre poți afișa arhivatele și le poți reactiva.
- O grupă poate fi ștearsă numai după mutarea sau eliminarea atribuirii tuturor copiilor ei, inclusiv celor arhivați. Pentru aceștia, afișează arhivatele în registrul Copii și modifică grupa din fișă; astfel, datele istorice și backupurile rămân valide pentru restaurare.

## Import și export

### Import copii CSV (adăugare, fără înlocuire)

În pagina **Copii**, apasă **Import copii CSV**, alege fișierul UTF-8 și verifică previzualizarea. Scrie **IMPORT COPII** și confirmă. Se adaugă numai copiii noi, într-o singură operațiune cu backup înainte și jurnal individual. Achitările, cheltuielile și fișele existente nu se modifică. O eroare de structură sau o dată invalidă blochează importul; dacă backupul local anterior nu poate fi creat, importul nu se execută.

Formatul `Lista_copiilor_inmatriculati.csv` este recunoscut direct, inclusiv antetele, datele ZZ.LL.AAAA, virgula/punctul și virgula/tabul ca separator și câmpurile între ghilimele. Numărul contractului și numele copilului sunt obligatorii. Sunt acceptate și coloanele opționale Părinte 2 și Telefon 2. Numerele de telefon sunt păstrate ca text, fără schimbarea prefixelor.

La reimport, contractele sau numele care coincid cu fișe existente sunt verificate și omise, nu suprascrise. Conflictele se afișează separat și nu se importă automat; verifică manual fișele. Datele modificate între previzualizare și confirmare blochează importul până la o nouă previzualizare.

CSV-ul nu conține grupa, taxa sau o confirmare a statutului actual: acestea rămân necompletate / De verificat. Un punct izolat în locul unei date este păstrat ca observație, iar câmpul rămâne gol. Datele calendaristice valide, dar cronologic neconcordante sunt păstrate și semnalate, fără corectare presupusă. Vârsta din sursă nu se importă ca valoare fixă. Observațiile originale și neclaritățile se păstrează în fișa copilului.

### Import Excel complet (înlocuire)

Istoricul din V5 a fost adăugat separat pe 08.09.2026: 810 achitări (10.105.096 lei, conform sumelor din sursă) și 1.201 cheltuieli (1.564.059 lei). Cele 105 fișe existente au rămas neschimbate. Identificatorii ID-… din V5 au fost corelați cu CSV-… numai după verificarea contractului, numelui și datei nașterii. Fiecare operațiune importată păstrează proveniența și apare în jurnal.

Cele 578 de achitări fără copil rămân neasociate. Potrivirile automate și posibilele dubluri din sursă nu au fost confirmate sau eliminate automat. Cele 3 achitări mixte cu sumă provizorie păstrează valoarea numerică și textul original din V5, cu avertizare explicită în De verificat. Totalul istoric al achitărilor nu este un total reconciliat până la clarificarea acestor înregistrări.

Nu folosi Import Excel complet pentru a repeta această adăugare: acesta înlocuiește toate datele. Instrumentul de mentenanță `node scripts/import-v5-history.mjs` face doar verificare; opțiunea `--apply` folosește importul financiar separat, cu backup anterior, control de versiune și protecție la reimport. Importul nu suprascrie copii sau operațiuni existente și se oprește la conflicte.

Importul acceptă V5 original și exportul complet al acestei versiuni. Sunt verificate datele, sumele, identificatorii unici și asocierile. Erorile blochează importul; avertizările cer revizuire. Verifică numerele și totalurile, apoi scrie IMPORT. Operațiunea înlocuiește datele după un backup.

Pentru V5 verificat la actualizare: 105 copii, 810 achitări (10.105.096 lei), 1.201 cheltuieli (1.564.059 lei). Taxele V5 fără valori și fără perioadă trebuie completate. Operațiunea de actualizare nu introduce automat datele V5 în baza reală.

Exportul include file lizibile și două file tehnice (`Startica_Format`, `Startica_Date`) pentru păstrarea tuturor câmpurilor. Reimportul folosește datele complete din aceste file; modificările manuale ale filelor de raport nu sunt reimportate. Pentru modificări, folosește aplicația. Exportul nu înlocuiește backupul SQLite și nu conține jurnalul complet de audit.

Restaurarea prezintă numărul de înregistrări și totalurile. Scrie RESTAUREAZA pentru confirmare. Înaintea înlocuirii se creează o copie a datelor curente. Jurnalul operațiunilor curente este păstrat; restaurarea este adăugată ca operațiune nouă.

## Verificări pentru dezvoltare

`npm test` (= `node --test tests/*.test.mjs`) — descoperă automat toate fișierele `*.test.mjs`: reguli financiare, import/export, backup/restaurare, protecțiile bazei, integritatea grupelor (inclusiv copii arhivați), calendarul aniversărilor și centrul de verificare. Testele API folosesc baze temporare.

`node tests/browser-smoke.mjs` (sau `npm run test:browser`) — Chrome headless, profil și bază temporare. Nu folosește profilul Chrome sau datele reale ale utilizatorului. Rulează separat de `npm test` pentru că are nevoie de Chrome instalat și durează mai mult.

`tests/desktop-lifecycle.ps1` — verifică lansatorul (`startica_desktop.ps1`): pornirea fără fereastră de consolă, oprirea la închiderea ferestrei, profil și bază temporare.
