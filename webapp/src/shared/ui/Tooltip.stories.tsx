import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { Tooltip } from './Tooltip';

const meta: Meta<typeof Tooltip> = {
  title: 'Fundamente/Tooltip',
  component: Tooltip,
  parameters: { design: 'DS Componente.dc.html §28g — balon la hover/focus' },
  args: { content: 'Șterge rândul' },
};
export default meta;

type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  render: args => (
    <Tooltip {...args}>
      <button type="button">Acțiune</button>
    </Tooltip>
  ),
};

export const Visible: Story = {
  render: args => (
    <Tooltip {...args}>
      <button type="button">Acțiune</button>
    </Tooltip>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.hover(canvas.getByRole('button'));
  },
};

export const Placements: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 48, padding: 48 }}>
      <Tooltip content="Sus" placement="top">
        <button type="button">Top</button>
      </Tooltip>
      <Tooltip content="Jos" placement="bottom">
        <button type="button">Bottom</button>
      </Tooltip>
      <Tooltip content="Stânga" placement="left">
        <button type="button">Left</button>
      </Tooltip>
      <Tooltip content="Dreapta" placement="right">
        <button type="button">Right</button>
      </Tooltip>
    </div>
  ),
};
