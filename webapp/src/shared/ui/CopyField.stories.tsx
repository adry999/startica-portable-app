import type { Meta, StoryObj } from '@storybook/react-vite';
import { CopyField } from './CopyField';

const meta: Meta<typeof CopyField> = {
  title: 'Componente/CopyField',
  component: CopyField,
  parameters: { design: 'DS Diverse.dc.html §32g — cod de asociere cu expirare' },
  args: { value: '7F3K-9QRT', ariaLabel: 'Cod de asociere', hint: 'Expiră în 4:32' },
};
export default meta;

type Story = StoryObj<typeof CopyField>;

export const Default: Story = {};

export const FaraHint: Story = { args: { hint: undefined } };
