import type { Meta, StoryObj } from '@storybook/react-vite';
import { MasterDetail } from './MasterDetail';

const meta: Meta<typeof MasterDetail> = {
  title: 'Tipare de pagină/MasterDetail',
  component: MasterDetail,
  parameters: { design: '31b — Achitări/De rezolvat/De notificat, vizual în Shell.dc.html#31b' },
  args: {
    master: <p>Listă plăți (Ionescu Maria, Popescu Andrei, Rusu Ana…)</p>,
    detail: <p>Detaliu plată selectată</p>,
  },
};
export default meta;

type Story = StoryObj<typeof MasterDetail>;

export const Default: Story = {
  render: args => (
    <div style={{ height: 180 }}>
      <MasterDetail {...args} />
    </div>
  ),
};

export const FixedDetailWidth: Story = {
  args: {
    detailWidth: 400,
    master: <p>Listă lată, grupată pe lună</p>,
    detail: <p>Detaliu plată selectată, lățime fixă 400px</p>,
  },
  render: args => (
    <div style={{ height: 180 }}>
      <MasterDetail {...args} />
    </div>
  ),
};
