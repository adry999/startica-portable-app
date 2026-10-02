import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { completProfile, normalizeProfile } from '#shared/domain/computer-profile.mjs';
import { ProfileEditor, type ProfileEditorProps } from './ProfileEditor';

function Controlled(props: Omit<ProfileEditorProps, 'onChange'>) {
  const [value, setValue] = useState(props.value);
  return <ProfileEditor value={value} onChange={setValue} />;
}

const meta: Meta<typeof Controlled> = {
  title: 'Sincronizare/ProfileEditor',
  component: Controlled,
  parameters: { design: '31-profiluri-calculator.md 36a/36b' },
};
export default meta;

type Story = StoryObj<typeof Controlled>;

/** Pasul 1 (36a) — preset-urile fixe, Complet selectat implicit. */
export const Complet: Story = { args: { value: completProfile() } };

/** Educator — rezumatul din dreapta arată doar modulele cu acces (36a). */
export const Educator: Story = { args: { value: normalizeProfile({ preset: 'educator' }) } };

/** Personalizat — matricea pe module, cu PIN la intrare (36b). Administrare rămâne blocată. */
export const Personalizat: Story = { args: { value: normalizeProfile({ preset: 'personalizat' }) } };

/** Personalizat cu câteva module deja ridicate la Modifică/Vede, ca să se vadă rezumatul de jos. */
export const PersonalizatCuAcces: Story = {
  args: {
    value: normalizeProfile({
      preset: 'personalizat',
      modules: { attendance: 2, children: 1, payments: 2 },
      pinModules: ['payments'],
    }),
  },
};
