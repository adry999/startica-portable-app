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

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(<MasterDetail master={<p>Lista</p>} detail={<p>Detaliu</p>} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
