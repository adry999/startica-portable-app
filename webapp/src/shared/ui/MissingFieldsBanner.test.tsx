import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { MissingFieldsBanner } from './MissingFieldsBanner';

describe('MissingFieldsBanner', () => {
  it('nu randează nimic când nu lipsește niciun câmp', () => {
    const { container } = render(<MissingFieldsBanner fields={[]} onFieldClick={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('arată numărul de câmpuri lipsă și o pastilă pentru fiecare', () => {
    render(
      <MissingFieldsBanner
        fields={[
          { key: 'phone', label: 'Telefon părinte 1', required: true },
          { key: 'idnp', label: 'IDNP', required: false },
        ]}
        onFieldClick={() => {}}
      />,
    );
    expect(screen.getByText('Lipsesc 2 date')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Telefon părinte 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'IDNP' })).toBeInTheDocument();
  });

  it('folosește singularul „dată” pentru un singur câmp lipsă', () => {
    render(<MissingFieldsBanner fields={[{ key: 'idnp', label: 'IDNP', required: false }]} onFieldClick={() => {}} />);
    expect(screen.getByText('Lipsește 1 dată')).toBeInTheDocument();
  });

  it('e roz dacă lipsește cel puțin un câmp obligatoriu, galben dacă doar recomandate', () => {
    const { container: pink } = render(
      <MissingFieldsBanner
        fields={[{ key: 'phone', label: 'Telefon părinte 1', required: true }]}
        onFieldClick={() => {}}
      />,
    );
    expect(pink.querySelector('[role="status"]')?.className).toMatch(/pink/);

    const { container: yellow } = render(
      <MissingFieldsBanner fields={[{ key: 'idnp', label: 'IDNP', required: false }]} onFieldClick={() => {}} />,
    );
    expect(yellow.querySelector('[role="status"]')?.className).toMatch(/yellow/);
  });

  it('clic pe o pastilă cheamă onFieldClick cu acel câmp', async () => {
    const onFieldClick = vi.fn();
    const field = { key: 'idnp', label: 'IDNP', required: false };
    render(<MissingFieldsBanner fields={[field]} onFieldClick={onFieldClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'IDNP' }));
    expect(onFieldClick).toHaveBeenCalledWith(field);
  });

  it('clic pe „Completează” cheamă onFieldClick cu primul câmp lipsă', async () => {
    const onFieldClick = vi.fn();
    const first = { key: 'phone', label: 'Telefon părinte 1', required: true };
    const second = { key: 'idnp', label: 'IDNP', required: false };
    render(<MissingFieldsBanner fields={[first, second]} onFieldClick={onFieldClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Completează' }));
    expect(onFieldClick).toHaveBeenCalledWith(first);
  });

  it('fără încălcări axe (R6)', async () => {
    const { container } = render(
      <MissingFieldsBanner
        fields={[{ key: 'phone', label: 'Telefon părinte 1', required: true }]}
        onFieldClick={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
