import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScrollArea } from './ScrollArea';

const meta: Meta<typeof ScrollArea> = {
  title: 'Componente/ScrollArea',
  component: ScrollArea,
  parameters: {
    design: 'Formulare.dc.html#15g (13-formulare.md 15g) — bară de 3px, 5px la hover/tragere, pistă invizibilă',
  },
  args: {
    children: (
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {Array.from({ length: 20 }, (_, index) => (
          <li key={index}>Element {index + 1}</li>
        ))}
      </ul>
    ),
  },
};
export default meta;

type Story = StoryObj<typeof ScrollArea>;

export const Default: Story = {
  decorators: [
    Story => (
      <div style={{ height: 160, width: 240 }}>
        <Story />
      </div>
    ),
  ],
};
