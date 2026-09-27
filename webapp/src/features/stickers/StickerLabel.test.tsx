import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StickerLabel } from './StickerLabel';

describe('StickerLabel', () => {
  it('arată cele 3 rânduri și eticheta scurtă', () => {
    render(
      <StickerLabel
        size="58x40"
        decor="cercuri"
        line1="Avram Maria"
        line2="Grupa Mars"
        line3="dulapul 7"
        badge=""
        showIcon
      />,
    );
    expect(screen.getByText('Avram Maria')).toBeInTheDocument();
    expect(screen.getByText('Grupa Mars')).toBeInTheDocument();
    expect(screen.getByText('dulapul 7')).toBeInTheDocument();
  });

  it('arată eticheta scurtă (badge) când e dată', () => {
    render(
      <StickerLabel size="58x40" decor="simplu" line1="Fără arahide" line2="" line3="" badge="ALERGIE" showIcon />,
    );
    expect(screen.getByText('ALERGIE')).toBeInTheDocument();
  });

  it('nu arată pictograma la mărimea 58×30, chiar dacă showIcon e true', () => {
    const { container } = render(
      <StickerLabel size="58x30" decor="simplu" line1="Avram Maria" line2="" line3="" badge="" showIcon />,
    );
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('arată pictograma la 58×40 când showIcon e true', () => {
    const { container } = render(
      <StickerLabel size="58x40" decor="simplu" line1="Avram Maria" line2="" line3="" badge="" showIcon />,
    );
    expect(container.querySelector('img')).toBeInTheDocument();
  });

  it('setează înălțimea etichetei după mărimea aleasă', () => {
    render(
      <StickerLabel size="58x60" decor="simplu" line1="Avram Maria" line2="" line3="" badge="" showIcon={false} />,
    );
    expect(screen.getByTestId('sticker-label').getAttribute('style')).toContain('height: 60mm');
  });
});
