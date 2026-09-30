import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StepList } from './StepList';

describe('StepList', () => {
  it('randează pașii cu eticheta și durata', () => {
    render(
      <StepList
        steps={[
          { key: 'server', label: 'Pornesc serverul local', status: 'done', duration: '0,4 s' },
          { key: 'database', label: 'Citesc baza de date', status: 'current' },
          { key: 'dashboard', label: 'Pregătesc Dashboard-ul', status: 'pending' },
        ]}
      />,
    );
    expect(screen.getByText('Pornesc serverul local')).toBeInTheDocument();
    expect(screen.getByText('0,4 s')).toBeInTheDocument();
    expect(screen.getByText('Citesc baza de date')).toBeInTheDocument();
    expect(screen.getByText('Pregătesc Dashboard-ul')).toBeInTheDocument();
  });
});
