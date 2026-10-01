import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { LoadingState } from './LoadingState';
import { useDelayedLoading } from './useDelayedLoading';

const meta: Meta<typeof LoadingState> = {
  title: 'Componente/LoadingState',
  component: LoadingState,
  parameters: { design: '21-incarcare.md §21b (între pagini) · vizual în Incarcare.dc.html#21b' },
};
export default meta;

type Story = StoryObj<typeof LoadingState>;

export const Default: Story = {};

/** Demonstrează pragul din `useDelayedLoading` (300ms) — comută starea ca să vezi când apare bara. */
function DelayedLoadingDemo() {
  const [active, setActive] = useState(true);
  const show = useDelayedLoading(active, 300);
  return (
    <div>
      <button type="button" onClick={() => setActive(current => !current)}>
        {active ? 'Oprește' : 'Pornește'} încărcarea
      </button>
      {show && <LoadingState />}
    </div>
  );
}

export const PragIntarziere: Story = {
  render: () => <DelayedLoadingDemo />,
};
