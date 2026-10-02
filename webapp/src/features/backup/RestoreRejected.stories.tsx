import type { Meta, StoryObj } from '@storybook/react-vite';
import { RestoreRejected } from './RestoreRejected';

const meta: Meta<typeof RestoreRejected> = {
  title: 'Backup/RestoreRejected',
  component: RestoreRejected,
  parameters: { design: 'Prima pornire.dc.html#46c — arhivă respinsă (3 cazuri, același ecran)' },
};
export default meta;

type Story = StoryObj<typeof RestoreRejected>;

export const VersiuneMaiNoua: Story = {
  args: {
    items: [
      {
        tone: 'blocked',
        title: 'Versiune mai nouă',
        message:
          'Backup-ul e făcut cu Startica 2.4.0. Aici rulează 2.2.0. Actualizează aplicația, apoi încearcă din nou.',
      },
    ],
  },
};

export const NumaratoareaNuCorespunde: Story = {
  args: {
    items: [
      {
        tone: 'blocked',
        title: 'Numărătoarea nu corespunde',
        message: 'Buiucani: manifestul spune 911 achitări, în fișier sunt 904. Nimic nu s-a scris pe disc.',
      },
    ],
  },
};

export const BackupVechiAvertisment: Story = {
  args: {
    items: [
      {
        tone: 'warning',
        title: 'Backup vechi (.db) · avertisment, se poate continua',
        message: 'Conține o singură filială. Comun și celelalte filiale rămân goale; le completezi după.',
      },
    ],
  },
};

export const ToateCazurile: Story = {
  args: {
    items: [
      {
        tone: 'blocked',
        title: 'Versiune mai nouă',
        message: 'Backup-ul e făcut cu Startica 2.4.0. Aici rulează 2.2.0.',
      },
      {
        tone: 'blocked',
        title: 'Numărătoarea nu corespunde',
        message: 'Buiucani: manifestul spune 911 achitări, în fișier sunt 904.',
      },
      {
        tone: 'warning',
        title: 'Backup vechi (.db) · avertisment, se poate continua',
        message: 'Conține o singură filială; Comun și celelalte filiale nu se schimbă.',
      },
    ],
  },
};
