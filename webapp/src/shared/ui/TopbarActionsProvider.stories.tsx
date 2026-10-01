import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  TopbarActionsProvider,
  useTopbarActions,
  useTopbarActionsSlot,
  useTopbarTitle,
  useTopbarTitleSlot,
} from './TopbarActions';

/** Simulează `Topbar`-ul real: citește sloțurile, nu le scrie. */
function FakeTopbar() {
  const actions = useTopbarActionsSlot();
  const titleOverride = useTopbarTitleSlot();
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid #ccc', padding: 8 }}>
      <span>{titleOverride?.title ?? 'Titlu implicit'}</span>
      <div>{actions}</div>
    </div>
  );
}

/** Simulează un ecran al aplicației: își pune butoanele și titlul propriu în slot. */
function FakeScreen() {
  useTopbarActions(<button type="button">+ Adaugă copil</button>);
  useTopbarTitle({ title: 'Zile de naștere', eyebrow: 'Copii' });
  return (
    <div style={{ padding: 8 }}>
      <span>Ecranul curent a pus butonul în slotul de mai sus.</span> <span>Și titlul propriu, „Zile de naștere”.</span>
    </div>
  );
}

function TopbarActionsDemo() {
  return (
    <div>
      <FakeTopbar />
      <FakeScreen />
    </div>
  );
}

const meta: Meta<typeof TopbarActionsProvider> = {
  title: 'Aplicație/TopbarActionsProvider',
  component: TopbarActionsProvider,
  parameters: { design: '00-comun.md §A (Antet compact / Topbar) — slotul de butoane și titlu al ecranului curent' },
  args: { children: <TopbarActionsDemo /> },
};
export default meta;

type Story = StoryObj<typeof TopbarActionsProvider>;

export const Default: Story = {};
