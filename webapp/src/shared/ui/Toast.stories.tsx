import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { ToastProvider, useToast } from './Toast';

/** Copil care cere un toast prin `useToast()` — `ToastProvider` doar montează coada, nu declanșează nimic singur. */
function ToastDemo({ actionLabel, stack = 1 }: { actionLabel?: string; stack?: number }) {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        for (let i = 0; i < stack; i += 1) {
          toast.show({
            message: stack > 1 ? `Achitare ${i + 1} arhivată` : '3 achitări arhivate',
            actionLabel,
            onAction: actionLabel ? () => {} : undefined,
          });
        }
      }}
    >
      Arată {stack > 1 ? `${stack} toast-uri` : 'un toast'}
    </button>
  );
}

const meta: Meta<typeof ToastProvider> = {
  title: 'Componente/Toast',
  component: ToastProvider,
  parameters: { design: '13-formulare.md (toast „Anulează” la arhivare) · vizual în Formulare.dc.html#15d–#15f' },
};
export default meta;

type Story = StoryObj<typeof ToastProvider>;

/** Stare implicită — coada e goală până la `show()`. */
export const Default: Story = {
  args: { children: <ToastDemo /> },
};

/** Mesaj simplu, fără acțiune — dispare singur după 6 secunde (vezi Toast.test.tsx). */
export const MesajSimplu: Story = {
  args: { children: <ToastDemo /> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Arată un toast' }));
    await expect(canvas.getByText('3 achitări arhivate')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'Anulează' })).not.toBeInTheDocument();
  },
};

/** Cu buton de acțiune (ex. „Anulează”) — clic pe el execută acțiunea și ascunde toast-ul. */
export const CuAcțiune: Story = {
  args: { children: <ToastDemo actionLabel="Anulează" /> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Arată un toast' }));
    const action = await canvas.findByRole('button', { name: 'Anulează' });
    await userEvent.click(action);
    await expect(canvas.queryByText('3 achitări arhivate')).not.toBeInTheDocument();
  },
};

/** Mai multe toast-uri simultan — se stivuiesc, fiecare cu propriul timer de dispariție. */
export const MaiMulteSimultan: Story = {
  args: { children: <ToastDemo stack={2} /> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Arată 2 toast-uri' }));
    await expect(canvas.getByText('Achitare 1 arhivată')).toBeInTheDocument();
    await expect(canvas.getByText('Achitare 2 arhivată')).toBeInTheDocument();
  },
};
