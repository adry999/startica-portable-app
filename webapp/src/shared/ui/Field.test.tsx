import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './Field';
import { TextInput } from './TextInput';

describe('Field', () => {
  it('leagă eticheta de control prin htmlFor/id', () => {
    render(
      <Field label="Nume" htmlFor="nume">
        <TextInput id="nume" value="" onChange={() => {}} />
      </Field>,
    );
    expect(screen.getByLabelText('Nume')).toBeInTheDocument();
  });

  it('arată „· opțional” doar cât `optional` e adevărat', () => {
    render(
      <Field label="Poreclă" htmlFor="porecla" optional>
        <TextInput id="porecla" value="" onChange={() => {}} />
      </Field>,
    );
    expect(screen.getByText('· opțional')).toBeInTheDocument();
  });

  it('eroarea înlocuiește ajutorul', () => {
    render(
      <Field label="Telefon" htmlFor="telefon" hint="Format +373…" error="Telefon invalid">
        <TextInput id="telefon" value="" onChange={() => {}} />
      </Field>,
    );
    expect(screen.getByText('Telefon invalid')).toBeInTheDocument();
    expect(screen.queryByText('Format +373…')).not.toBeInTheDocument();
  });
});
