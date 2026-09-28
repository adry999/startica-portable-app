import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProfileLayout, ProfileNotFound, ProfileSection, StatCard } from './ProfileLayout';

describe('ProfileLayout', () => {
  it('randează breadcrumb-ul și cheamă onClick la înapoi', async () => {
    const onBack = vi.fn();
    const { container } = render(
      <ProfileLayout
        back={{ label: 'Copii', onClick: onBack }}
        header={{ name: 'Coceva Alisa', tone: 'orange', meta: 'Contract 214' }}
        left={<p>stânga</p>}
        right={<p>dreapta</p>}
      />,
    );
    expect(container.querySelector('p')?.textContent).toBe('Copii / Coceva Alisa');
    await userEvent.click(screen.getByRole('button', { name: 'Copii' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('randează acțiunile din antet', () => {
    render(
      <ProfileLayout
        back={{ label: 'Copii', onClick: () => {} }}
        header={{ name: 'Ana', tone: 'mint', meta: '', actions: <button type="button">Editează fișa</button> }}
        left={<p>stânga</p>}
        right={<p>dreapta</p>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Editează fișa' })).toBeInTheDocument();
  });

  it('randează badge-urile din antet', () => {
    render(
      <ProfileLayout
        back={{ label: 'Personal', onClick: () => {} }}
        header={{ name: 'Bogdan', tone: 'orange', meta: '', badges: [{ label: 'Activ', tone: 'mint' }] }}
        left={<p>stânga</p>}
        right={<p>dreapta</p>}
      />,
    );
    expect(screen.getByText('Activ')).toBeInTheDocument();
  });

  it('trece pe o singură coloană sub 1200px', () => {
    const cssPath = join(dirname(fileURLToPath(import.meta.url)), 'ProfileLayout.module.css');
    const css = readFileSync(cssPath, 'utf8');
    const mediaBlock = css.slice(css.indexOf('@media (max-width: 1200px)'));
    expect(mediaBlock).toMatch(/grid-template-columns:\s*1fr/);
  });
});

describe('ProfileSection', () => {
  it('randează titlul și, opțional, acțiunea', async () => {
    const onAction = vi.fn();
    render(
      <ProfileSection title="Note" action={{ label: 'Toate →', onClick: onAction }}>
        <p>conținut</p>
      </ProfileSection>,
    );
    expect(screen.getByText('Note')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Toate →' }));
    expect(onAction).toHaveBeenCalled();
  });
});

describe('StatCard', () => {
  it('randează eticheta, valoarea și sub', () => {
    render(<StatCard label="Sold" value="0 lei" sub="La zi" />);
    expect(screen.getByText('Sold')).toBeInTheDocument();
    expect(screen.getByText('0 lei')).toBeInTheDocument();
    expect(screen.getByText('La zi')).toBeInTheDocument();
  });
});

describe('ProfileNotFound', () => {
  it('randează link-ul înapoi și mesajul', () => {
    render(<ProfileNotFound back={{ label: 'Copii', onClick: () => {} }} />);
    expect(screen.getByText('← Copii')).toBeInTheDocument();
    expect(screen.getByText('Fișa nu a putut fi găsită.')).toBeInTheDocument();
  });
});
