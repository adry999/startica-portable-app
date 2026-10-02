import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { QuickPaySearch } from './QuickPaySearch';
import type { Child, RecordsSnapshot } from '@contracts/record-types.mjs';

function child(overrides: Partial<Child> & { id: string; name: string }): Child {
  return {
    phone: '',
    phone2: '',
    parent: '',
    groupId: null,
    status: 'Activ',
    statusHistory: [],
    fee: null,
    feeHistory: [{ from: '2020-01', amount: 9845 }],
    attendanceDate: '2026-09-01',
    dueDay: 10,
    archived: false,
    ...overrides,
  } as Child;
}

const amedeia = child({ id: 'c1', name: 'Hudic Amedeia', phone: '+37369123456', groupId: 'g-neptun' });
const tudor = child({
  id: 'c2',
  name: 'Hudic Tudor',
  phone2: '+37369123456',
  groupId: 'g-marte',
  feeHistory: [{ from: '2020-01', amount: 4922 }],
});

const records: RecordsSnapshot = {
  children: [amedeia, tudor],
  payments: [
    {
      id: 'p1',
      date: '2026-09-05',
      childId: 'c2',
      amount: 4922,
      method: 'Cash',
      service: 'gradinita',
      tenders: [{ method: 'Cash', amount: 4922 }],
      allocations: [{ month: '2026-09', amount: 4922 }],
      archived: false,
    },
  ],
  expenses: [],
  groups: [
    { id: 'g-neptun', name: 'Neptun' },
    { id: 'g-marte', name: 'Marte' },
  ],
  categories: [],
  visits: [],
} as unknown as RecordsSnapshot;

const meta: Meta<typeof QuickPaySearch> = {
  title: 'Achitări/QuickPaySearch',
  component: QuickPaySearch,
  parameters: { design: 'COMPONENTE.md §44a — Feedback 01-10.dc.html#44a' },
  args: {
    records,
    onSelect: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof QuickPaySearch>;

/** Fără text scris încă — doar câmpul, cu `Kbd` „N”. */
export const Default: Story = {};

/** Tastează un nume — rezultatul direct, cu fratele (același telefon de părinte) dedesubt. */
export const WithSiblingBelow: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Încasare rapidă'), 'Amedeia');
    await expect(canvas.getByText('Hudic Amedeia')).toBeInTheDocument();
    await expect(canvas.getByText('Hudic Tudor')).toBeInTheDocument();
  },
};

/** Niciun copil nu se potrivește căutării. */
export const NoResults: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Încasare rapidă'), 'zzz-nimeni');
    await expect(canvas.getByText('Fără rezultate')).toBeInTheDocument();
  },
};

/** Săgeata jos mută rândul activ către al doilea rezultat. */
export const KeyboardNavigation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Încasare rapidă'), 'Hudic');
    await userEvent.keyboard('{ArrowDown}');
    const options = canvas.getAllByRole('option');
    await expect(options[1]).toHaveAttribute('aria-selected', 'true');
  },
};
