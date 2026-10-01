import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Wizard, type WizardStep } from './Wizard';

const STEPS: WizardStep[] = [
  { key: 'date', label: 'Date copil' },
  { key: 'parinti', label: 'Părinți' },
  { key: 'confirmare', label: 'Confirmare' },
];

const meta: Meta<typeof Wizard> = {
  title: 'Tipare de pagină/Wizard',
  component: Wizard,
  parameters: { design: '31d — flux Pornire, vizual în Shell.dc.html#31d' },
  args: {
    steps: STEPS,
    currentStepIndex: 1,
    onStepChange: fn(),
    onBack: fn(),
    onNext: fn(),
    onFinish: fn(),
  },
};
export default meta;

type Story = StoryObj<typeof Wizard>;

export const Default: Story = {
  render: args => {
    function Demo() {
      const [index, setIndex] = useState(args.currentStepIndex);
      return (
        <Wizard
          {...args}
          currentStepIndex={index}
          onStepChange={setIndex}
          onBack={() => setIndex(current => Math.max(0, current - 1))}
          onNext={() => setIndex(current => Math.min(STEPS.length - 1, current + 1))}
        >
          <p>Conținutul pasului „{STEPS[index].label}”.</p>
        </Wizard>
      );
    }
    return <Demo />;
  },
};

export const LastStep: Story = {
  args: { currentStepIndex: STEPS.length - 1 },
  render: args => <Wizard {...args}>{<p>Conținutul pasului „{STEPS[args.currentStepIndex].label}”.</p>}</Wizard>,
};
