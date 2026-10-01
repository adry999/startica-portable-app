import type { Meta, StoryObj } from '@storybook/react-vite';
import { groupTone } from './group-tone';
import { DEMO_GROUPS } from './stories.fixtures';

/** Randează rezultatul `groupTone` ca listă de pastile — nu e o componentă, doar o funcție pură. */
function GroupToneSwatches() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {DEMO_GROUPS.map(group => (
        <span key={group.id} data-tone={groupTone(group.id, DEMO_GROUPS)}>
          {group.name} · {groupTone(group.id, DEMO_GROUPS)}
        </span>
      ))}
    </div>
  );
}

const meta: Meta<typeof GroupToneSwatches> = {
  title: 'Diverse/groupTone',
  component: GroupToneSwatches,
  parameters: { design: '00-comun.md §C' },
};
export default meta;

type Story = StoryObj<typeof GroupToneSwatches>;

export const Default: Story = {};
