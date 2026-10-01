import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from './Skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'Componente/Skeleton',
  component: Skeleton,
  parameters: { design: '21-incarcare.md §21b (forma ecranului țintă) · vizual în Incarcare.dc.html#21b' },
};
export default meta;

type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {};
