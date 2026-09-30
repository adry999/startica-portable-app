import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { Wizard, type WizardStep } from './Wizard';

const STEPS: WizardStep[] = [
  { key: 'date', label: 'Date copil' },
  { key: 'parinti', label: 'Părinți' },
  { key: 'confirmare', label: 'Confirmare' },
];

describe('Wizard', () => {
  it('arată pașii și conținutul pasului curent', () => {
    render(
      <Wizard steps={STEPS} currentStepIndex={0} onStepChange={() => {}}>
        <p>Conținut pas 1</p>
      </Wizard>,
    );
    expect(screen.getByText('Date copil')).toBeInTheDocument();
    expect(screen.getByText('Părinți')).toBeInTheDocument();
    expect(screen.getByText('Conținut pas 1')).toBeInTheDocument();
  });

  it('nu arată „Înapoi” pe primul pas și cheamă onNext la „Continuă”', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(
      <Wizard steps={STEPS} currentStepIndex={0} onStepChange={() => {}} onNext={onNext}>
        <p>Pas 1</p>
      </Wizard>,
    );
    expect(screen.queryByRole('button', { name: 'Înapoi' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continuă' }));
    expect(onNext).toHaveBeenCalled();
  });

  it('arată „Înapoi” pe pașii intermediari și cheamă onBack', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(
      <Wizard steps={STEPS} currentStepIndex={1} onStepChange={() => {}} onBack={onBack}>
        <p>Pas 2</p>
      </Wizard>,
    );
    await user.click(screen.getByRole('button', { name: 'Înapoi' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('arată „Finalizează” în loc de „Continuă” pe ultimul pas, cu loading din finishing', () => {
    render(
      <Wizard steps={STEPS} currentStepIndex={2} onStepChange={() => {}} onFinish={() => {}} finishing>
        <p>Pas 3</p>
      </Wizard>,
    );
    expect(screen.queryByRole('button', { name: 'Continuă' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Finalizează/ })).toHaveAttribute('aria-busy', 'true');
  });

  it('nextDisabled dezactivează butonul din subsol', () => {
    render(
      <Wizard steps={STEPS} currentStepIndex={0} onStepChange={() => {}} nextDisabled>
        <p>Pas 1</p>
      </Wizard>,
    );
    expect(screen.getByRole('button', { name: 'Continuă' })).toBeDisabled();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <Wizard steps={STEPS} currentStepIndex={1} onStepChange={() => {}}>
        <p>Pas 2</p>
      </Wizard>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
