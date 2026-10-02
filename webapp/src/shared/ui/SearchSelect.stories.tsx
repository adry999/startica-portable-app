import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { SearchSelect } from './SearchSelect';
import { Dot } from './Dot';
import { Button } from './Button';
import { DEMO_SEARCH_SELECT_OPTIONS } from './stories.fixtures';

const meta: Meta<typeof SearchSelect> = {
  title: 'Formular/SearchSelect',
  component: SearchSelect,
  parameters: { design: 'Grupe.dc.html#3a' },
  args: {
    options: DEMO_SEARCH_SELECT_OPTIONS,
    value: '',
    onChange: fn(),
    ariaLabel: 'Alege un copil',
    placeholder: 'Alege un copil…',
  },
};
export default meta;

type Story = StoryObj<typeof SearchSelect>;

export const Default: Story = {};

export const Disabled: Story = { args: { ariaLabel: 'Câmp dezactivat', disabled: true } };

// §16 (PROMPT-11 F28): grupe pe departament + punct de ton + „+ Funcție nouă” — ca Funcția din
// StaffFormDrawer.
export const GrupatCuPunctSiFooter: Story = {
  args: {
    ariaLabel: 'Funcția',
    placeholder: 'Alege funcția…',
    options: [
      { value: 'r1', label: 'Educator', group: 'Educatori', leading: <Dot tone="yellow" /> },
      { value: 'r2', label: 'Asistent', group: 'Educatori', leading: <Dot tone="yellow" /> },
      { value: 'r3', label: 'Logoped', group: 'Specialiști', leading: <Dot tone="pink" /> },
    ],
    footer: <Button variant="link">+ Funcție nouă</Button>,
  },
};
