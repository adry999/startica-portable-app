import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SmsConfirmDialog, type SmsRecipientView } from './SmsConfirmDialog';
import type { SmsSendResultView } from '@shared/sms';

function renderDialog(props: Partial<Parameters<typeof SmsConfirmDialog>[0]> = {}) {
  const defaultRecipients: SmsRecipientView[] = [
    { id: 'c1', name: 'Andrei Popescu', phone: '+37369000000', text: 'Salut, Andrei!', rest: 500 },
  ];
  return render(
    <MemoryRouter>
      <SmsConfirmDialog
        open
        mode="single"
        recipients={defaultRecipients}
        unitCostLei={0.3}
        balanceLei={100}
        onSend={vi.fn(async () => ({ ok: true, results: [], stopped: null }) as unknown as SmsSendResultView)}
        onClose={vi.fn()}
        onSent={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

const sentResult: SmsSendResultView = {
  ok: true,
  results: [
    { childId: 'c1', outcome: 'sent', logId: 1, segments: 1, cost: '0.30', error: '' },
    { childId: 'c2', outcome: 'sent', logId: 2, segments: 1, cost: '0.30', error: '' },
    { childId: 'c3', outcome: 'failed', logId: 3, segments: 1, cost: null, error: 'refuzat' },
    { childId: 'c4', outcome: 'skipped', logId: null, segments: 0, cost: null, error: '' },
  ],
  stopped: null,
} as unknown as SmsSendResultView;

describe('SmsConfirmDialog — mod single', () => {
  it('arată contorul roșu (ucs2) pentru un text cu diacritice', () => {
    renderDialog({
      recipients: [{ id: 'c1', name: 'Andrei Popescu', phone: '+37369000000', text: 'Ne aștinem plata, mulțumim' }],
    });

    expect(screen.getByTestId('sms-segment-counter').className).toContain('ucs2');
  });

  it('dezactivează „Trimite" când telefonul e null și arată legătura de corectare', () => {
    renderDialog({
      recipients: [{ id: 'c1', name: 'Andrei Popescu', phone: null, text: 'Salut' }],
    });

    expect(screen.getByText('Fără telefon valid')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Corectează telefonul' })).toHaveAttribute('href', '/copii/c1');
    expect(screen.getByRole('button', { name: /Trimite SMS/ })).toBeDisabled();
  });
});

describe('SmsConfirmDialog — mod bulk', () => {
  const bulkRecipients: SmsRecipientView[] = [
    { id: 'c1', name: 'Andrei Popescu', phone: '+37369000000', text: 'Mesaj 1' },
    { id: 'c2', name: 'Maria Ionescu', phone: '+37369000001', text: 'Mesaj 2', excludeReason: 'notificat azi' },
  ];

  it('un destinatar cu excludeReason e debifat implicit', () => {
    renderDialog({ mode: 'bulk', recipients: bulkRecipients });

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it('dezactivează „Trimite" când niciun destinatar nu e bifat', async () => {
    renderDialog({ mode: 'bulk', recipients: bulkRecipients });
    const user = userEvent.setup();

    await user.click(screen.getAllByRole('checkbox')[0]);

    expect(screen.getByRole('button', { name: /Trimite/ })).toBeDisabled();
  });

  it('afișează rezultatul trimiterii și „Reîncearcă" apelează onRetry cu id-urile eșuate/netrimise', async () => {
    const onSend = vi.fn(async () => sentResult);
    const onRetry = vi.fn(async () => sentResult);
    renderDialog({
      mode: 'bulk',
      recipients: [
        { id: 'c1', name: 'A', phone: '+37369000000', text: 'm1' },
        { id: 'c2', name: 'B', phone: '+37369000001', text: 'm2' },
        { id: 'c3', name: 'C', phone: '+37369000002', text: 'm3' },
        { id: 'c4', name: 'D', phone: '+37369000003', text: 'm4' },
      ],
      onSend,
      onRetry,
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Trimite/ }));

    expect(await screen.findByText('2 trimise · 1 eșuate · 1 netrimise')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reîncearcă' }));
    expect(onRetry).toHaveBeenCalledWith(['c3', 'c4']);
  });
});
