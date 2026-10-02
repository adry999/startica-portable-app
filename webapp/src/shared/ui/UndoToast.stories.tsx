import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { UndoToastProvider, useUndoToast } from './UndoToast';

/** Copil care cere un UndoToast prin `useUndoToast()` — Provider-ul doar montează, nu declanșează nimic singur. */
function UndoToastDemo({ fails = false }: { fails?: boolean }) {
  const undoToast = useUndoToast();
  return (
    <button
      type="button"
      onClick={() =>
        undoToast.show({
          title: 'Cheltuială adăugată',
          detail: '150,00 lei · Alimentație',
          onUndo: () => (fails ? Promise.reject(new Error('S-a modificat între timp.')) : Promise.resolve()),
        })
      }
    >
      Adaugă o cheltuială
    </button>
  );
}

const meta: Meta<typeof UndoToastProvider> = {
  title: 'Componente/UndoToast',
  component: UndoToastProvider,
  parameters: {
    design: 'COMPONENTE.md §8.2 (40b „Anulează după salvare”) · PROMPT-CLAUDE-CODE-8.md §8',
  },
};
export default meta;

type Story = StoryObj<typeof UndoToastProvider>;

/** Stare implicită — toast ascuns până la `show()`. */
export const Default: Story = {
  args: { children: <UndoToastDemo /> },
};

/** Apare jos-centru cu numărătoarea de 10 secunde. */
export const Activ: Story = {
  args: { children: <UndoToastDemo /> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Adaugă o cheltuială' }));
    await expect(canvas.getByText('Cheltuială adăugată')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Anulează · 10' })).toBeInTheDocument();
  },
};

/** `onUndo` respins (ex. înregistrarea s-a schimbat între timp) — mesajul serverului ia locul detaliului. */
export const Eroare: Story = {
  args: { children: <UndoToastDemo fails /> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Adaugă o cheltuială' }));
    await userEvent.click(canvas.getByRole('button', { name: /Anulează · \d+/ }));
    await expect(await canvas.findByText('S-a modificat între timp.')).toBeInTheDocument();
  },
};
