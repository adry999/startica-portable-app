import type { ReactNode } from 'react';
import { Button } from './Button';
import { StepList, type StepListItem } from './StepList';
import styles from './Wizard.module.css';

export interface WizardStep {
  key: string;
  label: string;
}

export interface WizardProps {
  steps: WizardStep[];
  currentStepIndex: number;
  onStepChange: (index: number) => void;
  /** Conținutul pasului curent — apelantul randează pasul potrivit, Wizard doar arată indicatorul + butoanele. */
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  onFinish?: () => void;
  nextDisabled?: boolean;
  finishing?: boolean;
  className?: string;
}

/** Flux multi-pas cu indicator (peste `StepList`) și subsol Înapoi/Continuă/Finalizează (31d). */
export function Wizard({
  steps,
  currentStepIndex,
  onStepChange: _onStepChange,
  children,
  onBack,
  onNext,
  onFinish,
  nextDisabled,
  finishing,
  className,
}: WizardProps) {
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === steps.length - 1;

  const stepListItems: StepListItem[] = steps.map((step, index) => ({
    key: step.key,
    label: step.label,
    status: index < currentStepIndex ? 'done' : index === currentStepIndex ? 'current' : 'pending',
  }));

  const classes = className ? `${styles.root} ${className}` : styles.root;

  return (
    <div className={classes}>
      <StepList steps={stepListItems} />
      <div className={styles.content}>{children}</div>
      <div className={styles.footer}>
        {!isFirst && (
          <Button variant="outline" onClick={onBack}>
            Înapoi
          </Button>
        )}
        {isLast ? (
          <Button variant="primary" onClick={onFinish} disabled={nextDisabled} loading={finishing}>
            Finalizează
          </Button>
        ) : (
          <Button variant="primary" onClick={onNext} disabled={nextDisabled}>
            Continuă
          </Button>
        )}
      </div>
    </div>
  );
}
