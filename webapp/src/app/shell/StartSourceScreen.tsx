import { useState } from 'react';
import { Button } from '@shared/ui';
import styles from './StartSourceScreen.module.css';

export type StartSource = 'backup' | 'connect' | 'scratch';

interface SourceOption {
  value: StartSource;
  number: number;
  title: string;
  description: string;
  footer: string;
  continueLabel: string;
}

const OPTIONS: SourceOption[] = [
  {
    value: 'backup',
    number: 1,
    title: 'Din backup',
    description: 'Alege fișierul .zip (sau un .db vechi). Vezi ce conține înainte să restaurezi.',
    footer: 'Recomandat dacă ai mutat calculatorul',
    continueLabel: 'Continuă → Alege fișierul',
  },
  {
    value: 'connect',
    number: 2,
    title: 'Am Startica pe alt calculator',
    description: 'Conectează-te cu codul afișat pe primul calculator. Datele vin prin sincronizare.',
    footer: 'Conectare prin cod',
    continueLabel: 'Continuă → Conectare',
  },
  {
    value: 'scratch',
    number: 3,
    title: 'De la zero',
    description: 'Completezi grădinița, filialele și taxele, apoi poți importa din Excel.',
    footer: 'Pornești cu un calculator gol',
    continueLabel: 'Continuă',
  },
];

export interface StartSourceScreenProps {
  onContinue: (source: StartSource) => void;
}

/** 46a — primul ecran pe un calculator fără date, înaintea pașilor de prima pornire: alege
 * backup, sincronizare cu alt calculator, sau pornire de la zero. Cardul ales are contur
 * portocaliu (`ChoiceCards`-style, radius 20); Enter continuă cu opțiunea aleasă. */
export function StartSourceScreen({ onContinue }: StartSourceScreenProps) {
  const [selected, setSelected] = useState<StartSource>('backup');
  const selectedOption = OPTIONS.find(option => option.value === selected) ?? OPTIONS[0];

  function selectAndContinue(value: StartSource) {
    setSelected(value);
    onContinue(value);
  }

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <img src="/assets/startica-logo.svg" alt="Startica" className={styles.logo} />
        <div className={styles.heading}>
          <h2 className={styles.title}>Bun venit! De unde pornim?</h2>
          <span className={styles.subtitle}>Calculatorul nu are încă date Startica.</span>
        </div>
        <div className={styles.grid} role="radiogroup" aria-label="De unde pornim">
          {OPTIONS.map(option => {
            const active = option.value === selected;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                className={active ? `${styles.option} ${styles.optionActive}` : styles.option}
                onClick={() => setSelected(option.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    selectAndContinue(option.value);
                  }
                }}
              >
                <span className={styles.badge}>{option.number}</span>
                <span className={styles.optionTitle}>{option.title}</span>
                <span className={styles.optionDescription}>{option.description}</span>
                <span className={styles.optionFooter}>{option.footer}</span>
              </button>
            );
          })}
        </div>
        <div className={styles.footer}>
          <span className={styles.hint}>Cardul ales are contur portocaliu. Enter = Continuă.</span>
          <Button className={styles.continueButton} onClick={() => onContinue(selected)}>
            {selectedOption.continueLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
