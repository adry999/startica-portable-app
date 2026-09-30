import { useState } from 'react';
import {
  Badge,
  PrintFooter,
  PrintHeader,
  PrintTable,
  ScrollArea,
  SettingsList,
  SignatureLine,
  ThermalBlock,
  ThermalRule,
  TopbarActionsProvider,
  useTopbarActions,
  useTopbarActionsSlot,
  useTopbarTitle,
  useTopbarTitleSlot,
} from '@shared/ui';
import { ComponentShowcase } from '../ComponentShowcase';
import { DemoRow } from '../DemoRow';
import styles from './AlteleSection.module.css';

interface DemoSettingsItem {
  id: string;
  name: string;
  count: number;
  hidden: boolean;
}

const DEMO_SETTINGS_ITEMS: DemoSettingsItem[] = [
  { id: 'gradinita', name: 'Grădiniță', count: 12, hidden: false },
  { id: 'bazin', name: 'Bazin', count: 4, hidden: false },
  { id: 'excursie', name: 'Excursie', count: 0, hidden: true },
];

/**
 * Restul exporturilor din `@shared/ui`, care nu sunt componente vizuale de sine stătătoare:
 * `TopbarActionsProvider` ține slotul de butoane/titlu al antetului (randat de `AppShell`,
 * în afara arborelui paginii) — aici e simulat cu o „bară de antet” falsă lângă „ecranul”
 * care apelează hook-urile.
 */
export function AlteleSection() {
  const [items, setItems] = useState(DEMO_SETTINGS_ITEMS);

  function reorder(draggedId: string, targetId: string) {
    setItems(current => {
      const next = [...current];
      const from = next.findIndex(item => item.id === draggedId);
      const to = next.findIndex(item => item.id === targetId);
      if (from === -1 || to === -1) return current;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Altele</h2>

      <ComponentShowcase
        name="SettingsList"
        importLine="import { SettingsList } from '@shared/ui';"
        reference="COMPONENTE.md §2 · Backup și setări → Servicii (backup/ServicesSettings.tsx)"
      >
        <DemoRow label="control">
          <div className={styles.frame} data-export="SettingsList">
            <SettingsList
              items={items}
              ariaLabel="Servicii (demo)"
              onReorder={reorder}
              renderName={item => item.name}
              renderCount={item => `${item.count} ${item.count === 1 ? 'achitare' : 'achitări'}`}
              renderStatus={item => (
                <Badge tone={item.hidden ? 'neutral' : 'mint'}>{item.hidden ? 'Ascuns' : 'Activ'}</Badge>
              )}
              renderActions={() => <button type="button">Editează</button>}
            />
          </div>
        </DemoRow>
        <DemoRow label="gol">
          <div className={styles.frame}>
            <SettingsList<DemoSettingsItem>
              items={[]}
              ariaLabel="Servicii (demo, gol)"
              renderName={item => item.name}
              emptyMessage="Niciun element încă."
            />
          </div>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="ScrollArea"
        importLine="import { ScrollArea } from '@shared/ui';"
        reference="Formulare.dc.html#15g (13-formulare.md 15g) — bară de 3px, 5px la hover/tragere, pistă invizibilă"
      >
        <DemoRow label="demo">
          <div className={styles.scrollDemoFrame}>
            <ScrollArea>
              <ul className={styles.scrollDemoList}>
                {Array.from({ length: 20 }, (_, index) => (
                  <li key={index}>Element {index + 1}</li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="SignatureLine"
        importLine="import { SignatureLine } from '@shared/ui';"
        reference="DS Componente.dc.html#32f — bară + etichetă (Achitări, Bazin: PaymentReceipt/PaymentReceiptThermal/DayClosingReceipt)"
      >
        <DemoRow label="demo">
          <div className={styles.frame}>
            <SignatureLine>Primit: administrator</SignatureLine>
          </div>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="PrintHeader"
        importLine="import { PrintHeader } from '@shared/ui';"
        reference="DS Componente.dc.html#32f — antet A4 (Situația plăților, StatusPrint.tsx)"
      >
        <DemoRow label="demo">
          <div className={styles.frame}>
            <PrintHeader
              title="Situația plăților · septembrie 2026"
              subtitle="Situație la 30.09.2026 · filtru: toți"
              aside={
                <>
                  <span>Grădinița Startica</span>
                  <span>IDNO 1234567890123</span>
                </>
              }
            />
          </div>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="PrintTable"
        importLine="import { PrintTable } from '@shared/ui';"
        reference="DS Componente.dc.html#32f — tabel A4, cap repetat pe fiecare pagină (Situația plăților, StatusPrint.tsx)"
      >
        <DemoRow label="demo">
          <div className={styles.frame}>
            <PrintTable
              columns={[
                { key: 'name', header: 'Copil', render: (row: { name: string; amount: number }) => row.name },
                {
                  key: 'amount',
                  header: 'Rest',
                  align: 'end',
                  render: (row: { name: string; amount: number }) => `${row.amount} lei`,
                },
              ]}
              rows={[
                { name: 'Ana Popescu', amount: 0 },
                { name: 'Ion Rusu', amount: 350 },
              ]}
              rowKey={row => row.name}
              footer={
                <tr>
                  <td>Total · 2 copii</td>
                  <td style={{ textAlign: 'right' }}>350 lei</td>
                </tr>
              }
            />
          </div>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="PrintFooter"
        importLine="import { PrintFooter } from '@shared/ui';"
        reference="DS Componente.dc.html#32f — subsol A4 (Situația plăților, StatusPrint.tsx)"
      >
        <DemoRow label="demo">
          <div className={styles.frame}>
            <PrintFooter printedAt="2026-09-30T10:00:00.000Z">Sume în lei.</PrintFooter>
          </div>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="ThermalBlock"
        importLine="import { ThermalBlock, ThermalRule } from '@shared/ui';"
        reference="DS Componente.dc.html#32f — bon 58mm (Achitări/Bazin: PaymentReceiptThermal, DayClosingReceipt, PoolReceiptLabel)"
      >
        <DemoRow label="demo">
          <ThermalBlock actions={<button type="button">Tipărește</button>}>
            <span>ÎNCHIDEREA ZILEI</span>
            <div data-export="ThermalRule">
              <ThermalRule />
            </div>
            <span>Total: 1 250 lei</span>
            <ThermalRule variant="dashed" />
          </ThermalBlock>
        </DemoRow>
      </ComponentShowcase>

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
