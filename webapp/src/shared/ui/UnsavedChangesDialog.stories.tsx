import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';

const meta: Meta<typeof UnsavedChangesDialog> = {
  title: 'Tipare de pagină/UnsavedChangesDialog',
  component: UnsavedChangesDialog,
  parameters: { design: 'DS Componente 2.dc.html §34g — 3 alegeri' },
  args: {
    open: true,
    formName: 'copilul nou',
    changedFields: ['nume', 'telefon'],
    onDiscard: fn(),
    onStay: fn(),
    onSaveAndContinue: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof UnsavedChangesDialog>;

export const Default: Story = {};

export const SeSalveaza: Story = { args: { saving: true } };

/**
 * Reproducere 40c (PROMPT-8 §6b): × / Esc / clic pe fundal nu mai închid tăcut un `Drawer`
 * cu modificări nesalvate — `requestClose` din `useUnsavedChangesGuard` arată acest dialog
 * întâi. Povestea verifică doar cele trei acțiuni ale dialogului (Drawer-ul real e testat
 * în ecranele care îl folosesc, ex. `PaymentFormDrawer.test.tsx`).
 */
export const CeleTreiAlegeri: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('dialog', { name: 'Renunți la modificările din copilul nou?' })).toBeInTheDocument();
    await expect(canvas.getByText('Câmpuri modificate: nume, telefon.')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Rămân' }));
    await expect(args.onStay).toHaveBeenCalledOnce();

    await userEvent.click(canvas.getByRole('button', { name: 'Salvez și continui' }));
    await expect(args.onSaveAndContinue).toHaveBeenCalledOnce();

    await userEvent.click(canvas.getByRole('button', { name: 'Renunță' }));
    await expect(args.onDiscard).toHaveBeenCalledOnce();
  },
};
