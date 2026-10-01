import type { Meta, StoryObj } from '@storybook/react-vite';
import { BnmRateLink } from './BnmRateLink';
import { DEMO_DAY } from './stories.fixtures';

const meta: Meta<typeof BnmRateLink> = {
  title: 'Formular/BnmRateLink',
  component: BnmRateLink,
  parameters: { design: '16-planuri-eur.md §12b (badge „BNM dd.mm”) · vizual în Planuri si curs.dc.html#12b' },
  args: { date: DEMO_DAY },
};
export default meta;

type Story = StoryObj<typeof BnmRateLink>;

export const Default: Story = {};
