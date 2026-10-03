import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Dialog } from './Dialog';

const meta: Meta<typeof Dialog> = {
  title: 'Tipare de pagină/Dialog',
  component: Dialog,
  parameters: { design: 'DS Componente.dc.html §28g — panou modal centrat, scurt' },
  args: {
    open: true,
    title: 'Trimite rezumatul acum?',
    onClose: fn(),
    primary: { label: 'Trimite', onClick: fn(), type: 'button' },
    children: <p>Conținut scurt — doar demonstrativ, fără date reale.</p>,
  },
};
export default meta;

type Story = StoryObj<typeof Dialog>;

/** Lățime implicită — 440px, token `--dialog` (44d). */
export const Default: Story = {};

/** Butonul principal cu `loading` (44d) — ambele butoane inactive, textul devine „Salvez…” (F19/§6). */
export const Loading: Story = {
  args: {
    primary: { label: 'Trimite', onClick: fn(), type: 'button', loading: true, loadingLabel: 'Se trimite…' },
  },
};

/** „N erori” fix în subsol (44d) — focus pe primul câmp cu eroare, numărate din validarea nativă
 * a `<form>`-ului din panou dacă apelantul nu dă `errorCount` explicit. */
export const WithErrors: Story = {
  args: {
    errorCount: 1,
    children: <p>Conținut scurt — „N erori” arată aici doar demonstrativ, prin `errorCount`.</p>,
  },
};
