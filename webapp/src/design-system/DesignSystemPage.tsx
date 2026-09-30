import { MemoryRouter } from 'react-router-dom';
import { ScrollArea, ToastProvider } from '@shared/ui';
import { AlteleSection } from './sections/AlteleSection';
import { ButoaneInputSection } from './sections/ButoaneInputSection';
import { DateSection } from './sections/DateSection';
import { FeedbackSection } from './sections/FeedbackSection';
import { FundamenteSection } from './sections/FundamenteSection';
import { GriduriSection } from './sections/GriduriSection';
import { ShellSection } from './sections/ShellSection';
import styles from './DesignSystemPage.module.css';

const SECTIONS = [
  { id: 'fundamente', label: 'Fundamente' },
  { id: 'butoane-input', label: 'Butoane & input' },
  { id: 'date', label: 'Date' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'altele', label: 'Altele' },
  { id: 'grile', label: 'Grile' },
  { id: 'aplicatie', label: 'Aplicație' },
] as const;

/**
 * Pagina „design system": randează fiecare export din `@shared/ui` cu variantele lui,
 * ca referință vizuală lângă artboard-urile din `docs/design/*.dc.html`. Nu are backend —
 * componentele care au nevoie de un provider (`ToastProvider`, router pentru `Link`) îl
 * primesc aici, cu date fixe (`fixtures.ts`), niciun apel `/api/*`.
 */
export function DesignSystemPage() {
  return (
    <MemoryRouter>
      <ToastProvider>
        <div className={styles.layout}>
          <nav className={styles.nav} aria-label="Secțiuni">
            <ScrollArea className={styles.navScroll}>
              <p className={styles.navTitle}>Startica · Design system</p>
              <ul className={styles.navList}>
                {SECTIONS.map(section => (
                  <li key={section.id}>
                    <a href={`#${section.id}`}>{section.label}</a>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </nav>
          <main className={styles.content}>
            <header className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>Design system</h1>
              <p className={styles.pageSubtitle}>
                Toate componentele din <code>@shared/ui</code>, cu variantele și starile lor — pentru comparat cu
                referințele din <code>docs/design/*.dc.html</code>.
              </p>
            </header>
            <section id="fundamente">
              <FundamenteSection />
            </section>
            <section id="butoane-input">
              <ButoaneInputSection />
            </section>
            <section id="date">
              <DateSection />
            </section>
            <section id="feedback">
              <FeedbackSection />
            </section>
            <section id="altele">
              <AlteleSection />
            </section>
            <section id="grile">
              <GriduriSection />
            </section>
            <section id="aplicatie">
              <ShellSection />
            </section>
          </main>
        </div>
      </ToastProvider>
    </MemoryRouter>
  );
}
