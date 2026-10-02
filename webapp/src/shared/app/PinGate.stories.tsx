import type { Meta, StoryObj } from '@storybook/react-vite';
import { PinGate } from './PinGate';

const meta: Meta<typeof PinGate> = {
  title: 'Aplicație/PinGate',
  component: PinGate,
  parameters: {
    design:
      'docs/design/screens/31-profiluri-calculator.md (36h) · generalizarea PinGate-ului din features/personal (23d) ' +
      'pentru orice modul din profile.pinModules — PIN-ul demo e „1234”.',
  },
  args: {
    label: 'Achitările',
    children: <p>Conținutul protejat, vizibil doar deblocat.</p>,
  },
};
export default meta;

type Story = StoryObj<typeof PinGate>;

/** Titlu/subtitlu implicite, cu eticheta modulului injectată. */
export const Implicit: Story = {};

/** Salarii își păstrează formularea originală (23d), neschimbată de generalizare. */
export const TitluPropriu: Story = {
  args: {
    label: 'Salariile',
    title: 'Salariile sunt protejate',
    subtitle: 'Introdu PIN-ul administrator (4–6 cifre).',
  },
};
