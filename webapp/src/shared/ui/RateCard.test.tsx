import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { RateCard } from './RateCard';

describe('RateCard', () => {
  it('fără curs cunoscut: arată mesajul și acțiunea principală', () => {
    const onClick = vi.fn();
    render(
      <RateCard
        rate={undefined}
        rateDate={undefined}
        rateIsToday={false}
        tone={null}
        primaryAction={{ label: 'Preia de la BNM', onClick }}
      />,
    );
    expect(screen.getByText('Fără curs cunoscut')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preia de la BNM' })).toBeInTheDocument();
  });

  it('cu curs de azi (BNM): arată valoarea, badge-ul și nota', () => {
    render(
      <RateCard
        rate={19.74}
        rateDate="2026-10-02"
        rateIsToday
        tone="mint"
        primaryAction={{ label: 'Corectează cursul de azi', onClick: () => {} }}
      />,
    );
    expect(screen.getByText('1 € = 19,7400 lei')).toBeInTheDocument();
    expect(screen.getByText('BNM · automat')).toBeInTheDocument();
    expect(screen.getByText(/Cursul BNM de azi/)).toBeInTheDocument();
  });

  it('curs corectat manual: arată badge-ul și nota corespunzătoare', () => {
    render(
      <RateCard
        rate={19.8}
        rateDate="2026-10-02"
        rateIsToday
        tone="yellow"
        primaryAction={{ label: 'Revino la cursul BNM', onClick: () => {} }}
      />,
    );
    expect(screen.getByText('corectat manual')).toBeInTheDocument();
    expect(screen.getByText(/Corectat manual pentru azi/)).toBeInTheDocument();
  });

  it('fără „Mâine” când nu a fost dat', () => {
    render(
      <RateCard
        rate={19.74}
        rateDate="2026-10-02"
        rateIsToday
        tone="mint"
        primaryAction={{ label: 'Corectează cursul de azi', onClick: () => {} }}
      />,
    );
    expect(screen.queryByText(/Mâine/)).not.toBeInTheDocument();
  });

  it('cu „Mâine”: arată cursul, diferența și sursa', () => {
    render(
      <RateCard
        rate={19.74}
        rateDate="2026-10-02"
        rateIsToday
        tone="mint"
        tomorrow={{ date: '2026-10-03', rate: 19.8, diff: 0.06 }}
        primaryAction={{ label: 'Corectează cursul de azi', onClick: () => {} }}
      />,
    );
    expect(screen.getByText(/Mâine/)).toBeInTheDocument();
    expect(screen.getByText('19,8000 lei')).toBeInTheDocument();
    expect(screen.getByText('publicat de BNM')).toBeInTheDocument();
  });

  it('apelează primaryAction.onClick la click', async () => {
    const onClick = vi.fn();
    render(
      <RateCard
        rate={19.74}
        rateDate="2026-10-02"
        rateIsToday
        tone="mint"
        primaryAction={{ label: 'Corectează cursul de azi', onClick }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Corectează cursul de azi' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <RateCard
        rate={19.74}
        rateDate="2026-10-02"
        rateIsToday
        tone="mint"
        tomorrow={{ date: '2026-10-03', rate: 19.8, diff: 0.06 }}
        primaryAction={{ label: 'Corectează cursul de azi', onClick: () => {} }}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
