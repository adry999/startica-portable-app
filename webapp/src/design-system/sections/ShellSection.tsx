import { useState } from 'react';
import {
  BranchSelector,
  type BranchOption,
  GlobalSearch,
  type GlobalSearchResult,
  MasterDetail,
  NavRail,
  type NavRailItem,
  SyncStatusCard,
  Wizard,
  type WizardStep,
} from '@shared/ui';
import { ComponentShowcase } from '../ComponentShowcase';
import { DemoRow } from '../DemoRow';
import styles from './ShellSection.module.css';

const NAV_ITEMS: NavRailItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'menu', active: true, onClick: () => {} },
  { key: 'copii', label: 'Copii', icon: 'search', onClick: () => {} },
  { key: 'grupe', label: 'Grupe', icon: 'grip-vertical', onClick: () => {} },
];

const GLOBAL_SEARCH_RESULTS: GlobalSearchResult[] = [
  { key: 'c1', label: 'Ionescu Maria', category: 'Copil', onSelect: () => {} },
  { key: 'a1', label: 'Rusu Ana', category: 'Angajat', onSelect: () => {} },
];

const BRANCHES: BranchOption[] = [
  { key: 'central', name: 'Filiala Centrală' },
  { key: 'nord', name: 'Filiala Nord' },
];

const WIZARD_STEPS: WizardStep[] = [
  { key: 'date', label: 'Date copil' },
  { key: 'parinti', label: 'Părinți' },
  { key: 'confirmare', label: 'Confirmare' },
];

/** Componentele „shell”-ului aplicației — navigare, căutare, filială, sincronizare (COMPONENTE.md §0f). */
export function ShellSection() {
  const [globalSearchValue, setGlobalSearchValue] = useState('Ion');
  const [selectedBranch, setSelectedBranch] = useState('central');
  const [wizardStepIndex, setWizardStepIndex] = useState(1);

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Aplicație</h2>

      <ComponentShowcase
        name="MasterDetail"
        importLine="import { MasterDetail } from '@shared/ui';"
        reference="31b — Achitări/De rezolvat/De notificat, vizual în Shell.dc.html#31b"
      >
        <DemoRow label="control">
          <div style={{ height: 180 }}>
            <MasterDetail
              master={<p>Listă plăți (Ionescu Maria, Popescu Andrei, Rusu Ana…)</p>}
              detail={<p>Detaliu plată selectată</p>}
            />
          </div>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="Wizard"
        importLine="import { Wizard } from '@shared/ui';"
        reference="31d — flux Pornire, vizual în Shell.dc.html#31d"
      >
        <DemoRow label="control">
          <Wizard
            steps={WIZARD_STEPS}
            currentStepIndex={wizardStepIndex}
            onStepChange={setWizardStepIndex}
            onBack={() => setWizardStepIndex(index => Math.max(0, index - 1))}
            onNext={() => setWizardStepIndex(index => Math.min(WIZARD_STEPS.length - 1, index + 1))}
            onFinish={() => {}}
          >
            <p>Conținutul pasului „{WIZARD_STEPS[wizardStepIndex].label}”.</p>
          </Wizard>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="NavRail"
        importLine="import { NavRail } from '@shared/ui';"
        reference="31g / DS-IMPLEMENTARE.md §8 — bara de navigație principală"
      >
        <DemoRow label="control">
          <NavRail items={NAV_ITEMS} />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="GlobalSearch"
        importLine="import { GlobalSearch } from '@shared/ui';"
        reference="32a — căutare globală (Ctrl+K)"
      >
        <DemoRow label="control">
          <GlobalSearch value={globalSearchValue} onChange={setGlobalSearchValue} results={GLOBAL_SEARCH_RESULTS} />
        </DemoRow>
        <DemoRow label="loading">
          <GlobalSearch value="Ion" onChange={() => {}} results={[]} loading />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="BranchSelector"
        importLine="import { BranchSelector } from '@shared/ui';"
        reference="32b — comutarea filialei din antet"
      >
        <DemoRow label="control">
          <BranchSelector branches={BRANCHES} selectedKey={selectedBranch} onChange={setSelectedBranch} />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="SyncStatusCard"
        importLine="import { SyncStatusCard } from '@shared/ui';"
        reference="32b — starea sincronizării din antet"
      >
        <DemoRow label="synced">
          <SyncStatusCard state="synced" message="Sincronizat acum 2 minute" />
        </DemoRow>
        <DemoRow label="syncing">
          <SyncStatusCard state="syncing" message="Se sincronizează…" />
        </DemoRow>
        <DemoRow label="error">
          <SyncStatusCard state="error" message="Eroare la sincronizare" onRetry={() => {}} />
        </DemoRow>
        <DemoRow label="offline">
          <SyncStatusCard state="offline" message="Offline" />
        </DemoRow>
      </ComponentShowcase>
    </div>
  );
}
