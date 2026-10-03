import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Drawer } from './Drawer';

const meta: Meta<typeof Drawer> = {
  title: 'Tipare de pagină/Drawer',
  component: Drawer,
  parameters: { design: '13-formulare.md (panou lateral, comun 15a/15b) · vizual în Formulare.dc.html#15a' },
  args: {
    open: true,
    title: 'Achitare nouă (exemplu)',
    onClose: fn(),
    primary: { label: 'Salvează', onClick: fn(), type: 'button' },
    children: <p>Conținutul formularului — doar demonstrativ, fără date reale.</p>,
  },
};
export default meta;

type Story = StoryObj<typeof Drawer>;

/** `size="form"` (implicit) — 620px, token `--drawer-form` (44d). */
export const Default: Story = {};

/** `size="detail"` — 480px, token `--drawer-detail` (44d), pentru panouri mai simple. */
export const Detail: Story = {
  args: { size: 'detail', title: 'Istoric salariu (exemplu)' },
};

/** Butonul principal cu `loading` (44d) — ambele butoane inactive, textul devine „Salvez…” (F19/§6). */
export const Loading: Story = {
  args: {
    primary: { label: 'Salvează', onClick: fn(), type: 'button', loading: true },
  },
};

/** „N erori” fix în subsol (44d) — focus pe primul câmp cu eroare, numărate din validarea nativă
 * a `<form>`-ului din panou dacă apelantul nu dă `errorCount` explicit. */
export const WithErrors: Story = {
  args: {
    errorCount: 2,
    children: <p>Conținutul formularului — „N erori” arată aici doar demonstrativ, prin `errorCount`.</p>,
  },
};
