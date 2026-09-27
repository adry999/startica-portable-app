import {
  TopbarActionsProvider,
  useTopbarActions,
  useTopbarActionsSlot,
  useTopbarTitle,
  useTopbarTitleSlot,
} from '@shared/ui';
import { ComponentShowcase } from '../ComponentShowcase';
import { DemoRow } from '../DemoRow';
import styles from './AlteleSection.module.css';

/**
 * Restul exporturilor din `@shared/ui`, care nu sunt componente vizuale de sine stătătoare:
 * `TopbarActionsProvider` ține slotul de butoane/titlu al antetului (randat de `AppShell`,
 * în afara arborelui paginii) — aici e simulat cu o „bară de antet” falsă lângă „ecranul”
 * care apelează hook-urile.
 */
export function AlteleSection() {
  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Altele</h2>

      <ComponentShowcase
        name="TopbarActionsProvider"
        importLine="import { TopbarActionsProvider, useTopbarActions, useTopbarActionsSlot, useTopbarTitle, useTopbarTitleSlot } from '@shared/ui';"
        reference="00-comun.md §A (Antet compact / Topbar) — slotul de butoane și titlu al ecranului curent"
      >
        <DemoRow label="demo">
          <TopbarActionsProvider>
            <TopbarActionsDemo />
          </TopbarActionsProvider>
        </DemoRow>
      </ComponentShowcase>
    </div>
  );
}

function TopbarActionsDemo() {
  return (
    <div className={styles.demoFrame}>
      <FakeTopbar />
      <FakeScreen />
    </div>
  );
}

/** Simulează `Topbar`-ul real: citește slotul, nu îl scrie. */
function FakeTopbar() {
  const actions = useTopbarActionsSlot();
  const titleOverride = useTopbarTitleSlot();
  return (
    <div className={styles.fakeTopbar} data-export="useTopbarActionsSlot">
      <span data-export="useTopbarTitleSlot">{titleOverride?.title ?? 'Titlu implicit'}</span>
      <div>{actions}</div>
    </div>
  );
}

/** Simulează un ecran al aplicației: își pune butoanele și titlul propriu în slot. */
function FakeScreen() {
  useTopbarActions(<button type="button">+ Adaugă copil</button>);
  useTopbarTitle({ title: 'Zile de naștere', eyebrow: 'Copii' });
  return (
    <div className={styles.fakeScreen}>
      <span data-export="useTopbarActions">Ecranul curent a pus butonul în slotul de mai sus.</span>{' '}
      <span data-export="useTopbarTitle">Și titlul propriu, „Zile de naștere”.</span>
    </div>
  );
}
