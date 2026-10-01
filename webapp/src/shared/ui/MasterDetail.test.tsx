import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { MasterDetail } from './MasterDetail';

describe('MasterDetail', () => {
  it('randează atât panoul master cât și detaliul', () => {
    render(<MasterDetail master={<p>Lista plăți</p>} detail={<p>Detaliu plată</p>} />);
    expect(screen.getByText('Lista plăți')).toBeInTheDocument();
    expect(screen.getByText('Detaliu plată')).toBeInTheDocument();
  });

  it('aplică lățimea implicită de 360px panoului master', () => {
    render(<MasterDetail master={<p>Lista</p>} detail={<p>Detaliu</p>} />);
    expect(screen.getByText('Lista').parentElement).toHaveStyle({ width: '360px' });
  });

  it('acceptă o lățime custom pentru panoul master', () => {
    render(<MasterDetail master={<p>Lista</p>} detail={<p>Detaliu</p>} masterWidth={420} />);
    expect(screen.getByText('Lista').parentElement).toHaveStyle({ width: '420px' });
  });

  it('detailWidth dă lățime fixă detaliului și lasă master flexibil (listă lată + detaliu îngust)', () => {
    render(<MasterDetail master={<p>Lista</p>} detail={<p>Detaliu</p>} detailWidth={400} />);
    expect(screen.getByText('Detaliu').parentElement).toHaveStyle({ width: '400px', flex: 'none' });
    expect(screen.getByText('Lista').parentElement).toHaveStyle({ flex: '1' });
  });

  it('detailSide="start" randează detaliul înaintea listei', () => {
    render(<MasterDetail master={<p>Lista</p>} detail={<p>Detaliu</p>} detailSide="start" />);
    const root = screen.getByText('Lista').parentElement?.parentElement;
    expect(root?.firstElementChild).toBe(screen.getByText('Detaliu').parentElement);
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<MasterDetail master={<p>Lista</p>} detail={<p>Detaliu</p>} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
