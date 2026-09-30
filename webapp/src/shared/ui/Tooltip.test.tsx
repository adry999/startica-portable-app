import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('nu afișează balonul înainte de hover/focus', () => {
    render(
      <Tooltip content="Șterge rândul">
        <button type="button">Acțiune</button>
      </Tooltip>,
    );
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('afișează balonul la focus și îl ascunde la blur', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Șterge rândul">
        <button type="button">Acțiune</button>
      </Tooltip>,
    );
    await user.tab();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Șterge rândul');
    await user.tab();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('afișează balonul la hover și îl ascunde la mouse-leave', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Șterge rândul">
        <button type="button">Acțiune</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: 'Acțiune' });
    await user.hover(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await user.unhover(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('leagă declanșatorul de balon prin aria-describedby', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Șterge rândul">
        <button type="button">Acțiune</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: 'Acțiune' });
    await user.hover(trigger);
    const tooltip = screen.getByRole('tooltip');
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <Tooltip content="Șterge rândul">
        <button type="button">Acțiune</button>
      </Tooltip>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
