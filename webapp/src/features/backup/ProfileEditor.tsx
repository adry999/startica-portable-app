import { Badge, Card, ChoiceCards, SegmentedControl, Toggle, type BadgeTone } from '@shared/ui';
import {
  ACCESS_NONE,
  ACCESS_READ,
  ACCESS_WRITE,
  ADMIN_ONLY_MODULES,
  DEFAULT_PIN_MODULES,
  MODULE_IDS,
  MODULE_LABELS,
  PRESET_DESCRIPTIONS,
  PRESET_IDS,
  PRESET_LABELS,
  presetModules,
} from '#shared/domain/computer-profile.mjs';
import styles from './ProfileEditor.module.css';

const moduleLabels: Record<string, string> = MODULE_LABELS;
const presetLabels: Record<string, string> = PRESET_LABELS;
const presetDescriptions: Record<string, string> = PRESET_DESCRIPTIONS;

const ACCESS_OPTIONS = [
  { value: 'none', label: 'Nu vede' },
  { value: 'read', label: 'Vede' },
  { value: 'write', label: 'Modifică' },
] as const;

type AccessOption = (typeof ACCESS_OPTIONS)[number]['value'];

const ACCESS_FROM_LEVEL: Record<number, AccessOption> = {
  [ACCESS_NONE]: 'none',
  [ACCESS_READ]: 'read',
  [ACCESS_WRITE]: 'write',
};
const LEVEL_FROM_ACCESS: Record<AccessOption, number> = { none: ACCESS_NONE, read: ACCESS_READ, write: ACCESS_WRITE };

const LEVEL_BADGE: Record<number, { label: string; tone: BadgeTone }> = {
  [ACCESS_NONE]: { label: 'Nu vede', tone: 'neutral' },
  [ACCESS_READ]: { label: 'Vede', tone: 'blue' },
  [ACCESS_WRITE]: { label: 'Modifică', tone: 'mint' },
};

export interface ProfileEditorProps {
  value: import('#shared/domain/computer-profile.mjs').ComputerProfile;
  onChange: (value: import('#shared/domain/computer-profile.mjs').ComputerProfile) => void;
}

/**
 * Alegerea profilului unui calculator (36a: preset-urile fixe + rezumatul lor; 36b: matricea
 * Personalizat pe module, cu PIN la intrare) — folosit atât la pairing (SyncSettings), cât și
 * la „Schimbă” dintr-un rând din lista de calculatoare (DevicesList).
 *
 * Simplificare V1 asumată (ca restul stratului client §5.3): cele două ecrane din artboard
 * (pasul 1 cu rezumat, apoi un ecran separat pentru matrice) se țin într-un singur card, cu
 * matricea apărând sub alegere când se selectează Personalizat, nu pe un ecran separat.
 */
export function ProfileEditor({ value, onChange }: ProfileEditorProps) {
  function selectPreset(preset: string) {
    if (preset === value.preset) return;
    if (preset === 'personalizat') {
      // Păstrează modulele/PIN-urile deja alese dacă utilizatorul revine la Personalizat după
      // ce a încercat alt preset — altfel pornește de la „Nu vede” peste tot, cu PIN implicit.
      const alreadyCustomized = value.preset === 'personalizat';
      onChange({
        preset: 'personalizat',
        modules: alreadyCustomized ? value.modules : presetModules('personalizat'),
        pinModules: alreadyCustomized ? value.pinModules : [...DEFAULT_PIN_MODULES],
        blocked: value.blocked,
      });
      return;
    }
    onChange({ preset, modules: presetModules(preset), pinModules: value.pinModules, blocked: value.blocked });
  }

  function setModuleAccess(moduleId: string, option: AccessOption) {
    const level = LEVEL_FROM_ACCESS[option];
    const pinModules = level === ACCESS_NONE ? value.pinModules.filter(id => id !== moduleId) : value.pinModules;
    onChange({ ...value, modules: { ...value.modules, [moduleId]: level }, pinModules });
  }

  function togglePin(moduleId: string, enabled: boolean) {
    onChange({
      ...value,
      pinModules: enabled ? [...value.pinModules, moduleId] : value.pinModules.filter(id => id !== moduleId),
    });
  }

  const summaryModules = MODULE_IDS.filter(moduleId => value.modules[moduleId] > ACCESS_NONE);
  const writeCount = MODULE_IDS.filter(moduleId => value.modules[moduleId] === ACCESS_WRITE).length;
  const readCount = MODULE_IDS.filter(moduleId => value.modules[moduleId] === ACCESS_READ).length;
  const hasFinancialAccess = ['payments', 'expenses', 'status', 'report'].some(
    moduleId => value.modules[moduleId] > ACCESS_NONE,
  );

  return (
    <div className={styles.root}>
      <ChoiceCards
        ariaLabel="Profilul calculatorului"
        columns={1}
        value={value.preset}
        onChange={selectPreset}
        options={PRESET_IDS.map(preset => ({
          value: preset,
          title: presetLabels[preset],
          sub: presetDescriptions[preset],
        }))}
      />

      {value.preset === 'personalizat' ? (
        <Card className={styles.matrix}>
          <div className={styles.matrixHead}>
            <span>Modul</span>
            <span>Acces</span>
            <span>PIN la intrare</span>
          </div>
          {MODULE_IDS.map(moduleId => {
            const locked = ADMIN_ONLY_MODULES.includes(moduleId);
            if (locked) {
              // 36b: „Administrare, Salarii și Sincronizare rămân doar pe calculatoarele cu profil
              // Complet” — rândul e informativ, nu interactiv (SegmentedControl n-are stare
              // dezactivată; un control care arată „Modifică” selectabil, dar oricum reclampat la 0
              // de server, ar fi confuz, nu doar inutil).
              return (
                <div key={moduleId} className={`${styles.matrixRow} ${styles.matrixRowLocked}`}>
                  <span className={styles.matrixLabel}>{moduleLabels[moduleId]}</span>
                  <Badge tone="neutral">Nu vede</Badge>
                  <span />
                </div>
              );
            }
            const level = value.modules[moduleId];
            const pinChecked = value.pinModules.includes(moduleId) && level > ACCESS_NONE;
            return (
              <div key={moduleId} className={styles.matrixRow}>
                <span className={styles.matrixLabel}>{moduleLabels[moduleId]}</span>
                <SegmentedControl
                  ariaLabel={`Acces la ${moduleLabels[moduleId]}`}
                  options={ACCESS_OPTIONS as unknown as { value: AccessOption; label: string }[]}
                  value={ACCESS_FROM_LEVEL[level]}
                  onChange={option => setModuleAccess(moduleId, option)}
                />
                <Toggle
                  ariaLabel={`PIN la intrare pe ${moduleLabels[moduleId]}`}
                  checked={pinChecked}
                  disabled={level === ACCESS_NONE}
                  onChange={checked => togglePin(moduleId, checked)}
                />
              </div>
            );
          })}
          <p className={styles.matrixSummary}>
            {writeCount} {writeCount === 1 ? 'modul cu modificare' : 'module cu modificare'} · {readCount} doar citire
            {hasFinancialAccess ? ' · include date financiare' : ''}
          </p>
          <p className={styles.matrixNote}>
            Administrare, Salarii și Sincronizare rămân doar pe calculatoarele cu profil Complet.
          </p>
        </Card>
      ) : (
        <Card className={styles.summary}>
          <span className={styles.summaryTitle}>Pe acest calculator</span>
          {summaryModules.length === 0 ? (
            <p className={styles.matrixNote}>Fără niciun modul permis.</p>
          ) : (
            summaryModules.map(moduleId => {
              const badge = LEVEL_BADGE[value.modules[moduleId]];
              return (
                <div key={moduleId} className={styles.summaryRow}>
                  <span>{moduleLabels[moduleId]}</span>
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </div>
              );
            })
          )}
        </Card>
      )}
    </div>
  );
}
