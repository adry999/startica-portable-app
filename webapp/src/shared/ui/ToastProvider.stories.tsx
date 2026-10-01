import type { Meta, StoryObj } from '@storybook/react-vite';
import { ToastProvider, useToast } from './Toast';

/** Copil care cere un toast prin `useToast()` — `ToastProvider` doar montează coada, nu declanșează nimic singur. */
function ToastDemo() {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() => toast.show({ message: '3 achitări arhivate', actionLabel: 'Anulează', onAction: () => {} })}
    >
      Arată un toast
    </button>
  );
}

const meta: Meta<typeof ToastProvider> = {
  title: 'Componente/ToastProvider',
  component: ToastProvider,
  parameters: { design: '13-formulare.md (toast „Anulează” la arhivare) · vizual în Formulare.dc.html#15d–#15f' },
  args: { children: <ToastDemo /> },
};
export default meta;

type Story = StoryObj<typeof ToastProvider>;

export const Default: Story = {};
