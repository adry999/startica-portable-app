import { Card, Disclosure } from '@shared/ui';
import backupStyles from './BackupPage.module.css';
import styles from './AboutSettings.module.css';

interface AboutModule {
  title: string;
  /** Ce face, ce arată, ce poate face — în această ordine, câte o propoziție scurtă. */
  does: string;
  shows: string;
  can: string;
}

interface AboutGroup {
  title: string;
  modules: AboutModule[];
}

/** Descrierile de mai jos reflectă comportamentul actual al aplicației (verificat în auditul
 * vizual 03.10) — grupate exact ca în meniul lateral (`nav-items.ts`), ca pagina să rămână
 * sursa de adevăr „ce face fiecare ecran”, nu un README separat care se poate învechi. */
const GROUPS: AboutGroup[] = [
  {
    title: 'Evidență',
    modules: [
      {
        title: 'Dashboard',
        does: 'Rezumatul lunii curente dintr-o privire, la deschiderea aplicației.',
        shows: 'Câți copii sunt activi, încasări și cheltuieli ale lunii, restanțieri, zile de naștere apropiate.',
        can: 'Sare direct în Achitări, Situația plăților sau Copii din cardurile de pe ecran.',
      },
      {
        title: 'Copii',
        does: 'Evidența copiilor înscriși, cu fișa completă a fiecăruia.',
        shows:
          'Listă filtrabilă pe grupă și statut; fișa fiecărui copil cu date de contact, plan, istoric plăți și prezență.',
        can: 'Adaugă, editează, arhivează un copil; schimbă grupa sau planul; exportă fișa.',
      },
      {
        title: 'Grupe',
        does: 'Organizează copiii pe grupe (clase).',
        shows: 'Lista grupelor cu numărul de copii din fiecare și educatorii alocați.',
        can: 'Creează sau redenumește o grupă, mută copii între grupe.',
      },
      {
        title: 'Prezența',
        does: 'Condica zilnică de prezență pe grupă.',
        shows: 'Grid pe zile ale lunii, cu prezent/absent pentru fiecare copil.',
        can: 'Marchează prezența rapid, zi cu zi sau pe perioade.',
      },
      {
        title: 'Bazin',
        does: 'Programări la bazin, separate de restul taxelor (acolo unde filiala oferă acest serviciu).',
        shows: 'Calendar cu locuri ocupate/libere pe zi și bilete emise.',
        can: 'Rezervă un loc, anulează, tipărește biletul (bon 58mm).',
      },
      {
        title: 'Vizite',
        does: 'Evidența vizitelor de probă ale copiilor noi, înainte de înscriere.',
        shows: 'Lista vizitelor pe perioadă, cu statutul fiecăreia.',
        can: 'Programează o vizită nouă, o marchează ca finalizată sau o transformă în înscriere.',
      },
      {
        title: 'Personal',
        does: 'Evidența echipei: educatori și restul personalului.',
        shows: 'Listă angajați, pontaj (ore lucrate) și concedii.',
        can: 'Adaugă un angajat, înregistrează pontaj sau concediu, calculează salariul lunii ca o cheltuială.',
      },
    ],
  },
  {
    title: 'Contabilitate',
    modules: [
      {
        title: 'Achitări',
        does: 'Înregistrarea plăților făcute de părinți pentru taxa lunară și servicii (ex. Bazin).',
        shows:
          'Lista plăților pe lună, cu suma, metoda și copilul; pentru taxă în euro, suma în lei și cursul folosit.',
        can: 'Înregistrează o plată nouă, tipărește chitanța, corectează sau anulează o plată greșită.',
      },
      {
        title: 'Cheltuieli',
        does: 'Evidența cheltuielilor grădiniței (salarii, utilități, materiale etc.).',
        shows: 'Lista cheltuielilor pe lună sau pe zile, cu categorie și sumă.',
        can: 'Adaugă o cheltuială nouă, o editează sau o șterge.',
      },
      {
        title: 'Situația plăților',
        does: 'Arată, pentru luna aleasă, cine a plătit și cine mai are de plătit.',
        shows:
          'Un rând pe copil: taxa datorată, suma achitată, restul; pentru taxă în euro, echivalentul în lei lângă sumă.',
        can: 'Notifică un părinte restanțier (SMS, dacă e configurat), tipărește situația pe toată lista.',
      },
      {
        title: 'De notificat',
        does: 'Pregătește notificările către părinți (restanțe, zile de naștere, vizite).',
        shows: 'Lista persoanelor de notificat, grupate pe motiv.',
        can: 'Trimite notificările, dacă SMS.md e conectat (Backup și setări → Notificări).',
      },
      {
        title: 'Raport contabil',
        does: 'Centralizează încasările și cheltuielile unei perioade, pentru evidență sau export către contabil.',
        shows: 'Totaluri pe categorie și pe lună, inclusiv secțiunea separată pentru sumele în euro.',
        can: 'Exportă raportul (Excel) pentru perioada aleasă.',
      },
    ],
  },
  {
    title: 'De rezolvat',
    modules: [
      {
        title: 'Taxe și grupe',
        does: 'Stabilește planul și taxa lunară a fiecărui copil.',
        shows: 'Copiii fără plan/taxă setată, care au nevoie de completare.',
        can: 'Setează planul, taxa (lei sau euro) și grupa unui copil.',
      },
      {
        title: 'De verificat',
        does: 'Strânge situațiile care au nevoie de o decizie manuală (ex. posibile dubluri de plată).',
        shows: 'Lista cazurilor semnalate automat, cu motivul.',
        can: 'Confirmă sau respinge fiecare caz, după verificare.',
      },
      {
        title: 'Asociere achitări',
        does: 'Leagă o plată primită fără detalii clare (ex. import bancar) de copilul corect.',
        shows: 'Plățile neasociate, cu sugestii de potrivire.',
        can: 'Asociază manual o plată cu un copil.',
      },
      {
        title: 'Conflicte',
        does: 'Apare doar când se sincronizează mai multe calculatoare — arată înregistrările modificate simultan pe două calculatoare.',
        shows: 'Câmpul în conflict, cu valoarea de pe fiecare calculator și ora modificării.',
        can: 'Alege ce variantă rămâne; alegerea intră în Istoric.',
      },
    ],
  },
  {
    title: 'Administrare',
    modules: [
      {
        title: 'Istoric',
        does: 'Jurnalul tuturor modificărilor din aplicație (cine, ce, când).',
        shows: 'Lista cronologică, grupată pe zile, cu diferența „vechi → nou” pentru fiecare modificare.',
        can: 'Filtrează istoricul pe Copii, Achitări sau Grupe.',
      },
      {
        title: 'Notificări',
        does: 'Configurează canalul de notificări (Telegram sau SMS.md) și ce anume se notifică automat.',
        shows:
          'Contul conectat, comutatoare pentru fiecare tip de notificare (restanțe, zile de naștere, vizite, probleme la backup).',
        can: 'Conectează/deconectează contul, pornește/oprește fiecare tip de notificare.',
      },
      {
        title: 'Backup și setări',
        does: 'Vezi secțiunea de mai jos — e pagina pe care te afli acum.',
        shows: 'Filele Backup, Planuri și curs, Grădinița, Filiale, Sincronizare, Bazin, Servicii.',
        can: 'Tot ce ține de configurarea aplicației și siguranța datelor.',
      },
    ],
  },
];

export function AboutSettings() {
  return (
    <div className={styles.wrap}>
      <Card className={styles.introCard}>
        <h3 className={backupStyles.panelTitle}>Despre Startica</h3>
        <p className={styles.intro}>
          Startica e aplicația de evidență și contabilitate a grădiniței: copii, grupe, prezență, achitări, cheltuieli
          și tot ce ține de administrarea zilnică. Pagina de mai jos explică, pe scurt, ce face fiecare ecran — ca un
          mic tutorial, nu documentație tehnică.
        </p>
      </Card>

      {GROUPS.map(group => (
        <Card key={group.title} className={styles.groupCard}>
          <h3 className={backupStyles.panelTitle}>{group.title}</h3>
          <div className={styles.list}>
            {group.modules.map(module => (
              <Disclosure key={module.title} title={module.title}>
                <ul className={styles.bullets}>
                  <li>
                    <strong>Ce face:</strong> {module.does}
                  </li>
                  <li>
                    <strong>Ce arată:</strong> {module.shows}
                  </li>
                  <li>
                    <strong>Ce poți face:</strong> {module.can}
                  </li>
                </ul>
              </Disclosure>
            ))}
          </div>
        </Card>
      ))}

      <Card className={styles.groupCard}>
        <h3 className={backupStyles.panelTitle}>Date, backup și sincronizare</h3>
        <div className={styles.list}>
          <Disclosure title="Unde sunt stocate datele">
            <p className={styles.paragraph}>
              Toate datele stau local, pe calculator, într-o bază de date proprie fiecărei filiale (copii, grupe,
              achitări, cheltuieli, vizite) — nimic nu pleacă pe internet fără ca tu să configurezi sincronizarea sau un
              backup extern.
            </p>
          </Disclosure>
          <Disclosure title="Backup">
            <p className={styles.paragraph}>
              Aplicația face automat o copie de siguranță locală. Poți configura în plus o copie externă (stick, Google
              Drive sau alt folder sincronizat) — dacă discul calculatorului se strică, datele rămân în folderul extern.
              Vezi Backup și setări → fila Backup pentru stare și restaurare.
            </p>
          </Disclosure>
          <Disclosure title="Sincronizare între calculatoare">
            <p className={styles.paragraph}>
              Cu mai multe calculatoare conectate la același server de sincronizare, fiecare păstrează o copie locală și
              lucrează și fără internet; modificările se trimit automat când revine conexiunea. Dacă aceeași fișă e
              modificată pe două calculatoare înainte de sincronizare, apare un conflict pe care îl rezolvi tu (ecranul
              Conflicte) — nicio dată nu se pierde automat. Achitările și cheltuielile nu intră niciodată în conflict:
              sunt înregistrări noi, se păstrează toate.
            </p>
          </Disclosure>
          <Disclosure title="Filiale">
            <p className={styles.paragraph}>
              Două filiale ale aceleiași grădinițe folosesc aceeași aplicație, cu date complet separate — copii, grupe,
              planuri, achitări, cheltuieli, backup. Treci de la una la alta din selectorul din meniu.
            </p>
          </Disclosure>
          <Disclosure title="Actualizări">
            <p className={styles.paragraph}>
              Aplicația verifică automat dacă există o versiune nouă publicată și te anunță — actualizarea se instalează
              cu un singur click, fără să pierzi datele.
            </p>
          </Disclosure>
        </div>
      </Card>
    </div>
  );
}
