import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as SharedUi from '@shared/ui';
import { DesignSystemPage } from './DesignSystemPage';

/** Exporturi care nu sunt componente/hook-uri de arătat individual — verificate altfel, nu prin `data-export`. */
const RUNTIME_EXPORT_NAMES = Object.keys(SharedUi);

describe('DesignSystemPage', () => {
  it('nu are nicio secțiune fără export corespunzător (barrel-ul @shared/ui e complet acoperit)', () => {
    const { container } = render(<DesignSystemPage />);

    expect(RUNTIME_EXPORT_NAMES.length).toBeGreaterThan(0);

    for (const exportName of RUNTIME_EXPORT_NAMES) {
      const node = container.querySelector(`[data-export="${exportName}"]`);
      expect(node, `pagina design-system nu arată exportul „${exportName}" din shared/ui/index.ts`).not.toBeNull();
    }
  });

  it('randează antetul paginii și cele cinci secțiuni', () => {
    const { getByText, container } = render(<DesignSystemPage />);
    expect(getByText('Design system')).toBeInTheDocument();
    for (const sectionId of ['fundamente', 'butoane-input', 'date', 'feedback', 'altele']) {
      expect(container.querySelector(`#${sectionId}`)).not.toBeNull();
    }
  });
});
