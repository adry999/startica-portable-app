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

  it('fără `templates`, arată doar bula fixă (comportament vechi, fără selector)', () => {
    renderDialog({
      recipients: [{ id: 'c1', name: 'Andrei Popescu', phone: '+37369000000', text: 'Salut, Andrei!' }],
    });

    expect(screen.queryByRole('radiogroup', { name: 'Șablon' })).not.toBeInTheDocument();
    expect(screen.getByText('Salut, Andrei!')).toBeInTheDocument();
  });

  const templates = [
    {
      id: 't1',
      name: 'Restanță',
      body: 'Bună, {părinte}! Șablon restanță.',
      stripDiacritics: true,
      isDefault: true,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 't2',
      name: 'Prietenos',
      body: 'Bună, {părinte}! Șablon prietenos.',
      stripDiacritics: true,
      isDefault: false,
      createdAt: '',
      updatedAt: '',
    },
  ];

  it('comutarea șablonului schimbă textul din previzualizare', async () => {
    const user = userEvent.setup();
    renderDialog({
      recipients: [
        { id: 'c1', name: 'Andrei Popescu', phone: '+37369000000', text: 'Text implicit trimis de apelant' },
      ],
      templates,
      defaultTemplateId: 't1',
      renderTemplate: templateId => templates.find(t => t.id === templateId)?.body ?? '',
    });

    // Fără diacritice e bifat implicit — previzualizarea arată textul final, fără diacritice.
    expect(screen.getByText('Buna, {parinte}! Sablon restanta.')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Prietenos' }));
    expect(screen.getByText('Buna, {parinte}! Sablon prietenos.')).toBeInTheDocument();
  });

  it('a scrie în textarea personalizat comută pe „Personalizat" și actualizează previzualizarea', async () => {
    const user = userEvent.setup();
    renderDialog({
      recipients: [{ id: 'c1', name: 'Andrei Popescu', phone: '+37369000000', text: 'Text implicit' }],
      templates,
      defaultTemplateId: 't1',
      renderTemplate: templateId => templates.find(t => t.id === templateId)?.body ?? '',
    });

    await user.click(screen.getByRole('radio', { name: 'Personalizat' }));
    const textarea = screen.getByRole('textbox', { name: 'Text mesaj' });
    expect(textarea).toHaveValue('Bună, {părinte}! Șablon restanță.');

    await user.clear(textarea);
    await user.type(textarea, 'Text scris de mână');

    // Bula de previzualizare arată textul FINAL (Fără diacritice e bifat implicit) — vezi testul dedicat.
    expect(screen.getByText('Text scris de mana')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Personalizat' })).toHaveAttribute('aria-checked', 'true');
  });

  it('bifa „Fără diacritice" schimbă textul afișat și contorul', async () => {
    const user = userEvent.setup();
    renderDialog({
      recipients: [{ id: 'c1', name: 'Andrei Popescu', phone: '+37369000000', text: 'Ne așteptăm plata' }],
      templates,
      defaultTemplateId: 't1',
      renderTemplate: () => 'Ne așteptăm plata',
    });

    expect(screen.getByTestId('sms-segment-counter').className).not.toContain('ucs2');
    expect(screen.getByText('Ne asteptam plata')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Fără diacritice' }));

    expect(screen.getByText('Ne așteptăm plata')).toBeInTheDocument();
    expect(screen.getByTestId('sms-segment-counter').className).toContain('ucs2');
  });

  it('trimiterea după editare raportează templateId: null cu textul editat', async () => {
    const onSend = vi.fn(async () => ({ ok: true, results: [], stopped: null }) as unknown as SmsSendResultView);
    const user = userEvent.setup();
    renderDialog({
      recipients: [{ id: 'c1', name: 'Andrei Popescu', phone: '+37369000000', text: 'Text implicit' }],
      templates,
      defaultTemplateId: 't1',
      renderTemplate: templateId => templates.find(t => t.id === templateId)?.body ?? '',
      onSend,
    });

    await user.click(screen.getByRole('radio', { name: 'Personalizat' }));
    const textarea = screen.getByRole('textbox', { name: 'Text mesaj' });
    await user.clear(textarea);
    await user.type(textarea, 'Text final');
    await user.click(screen.getByRole('button', { name: /Trimite SMS/ }));

    expect(onSend).toHaveBeenCalledWith(['c1'], { templateId: null, text: 'Text final', stripDiacritics: true });
  });

  it('trimiterea cu un șablon selectat raportează id-ul acelui șablon', async () => {
    const onSend = vi.fn(async () => ({ ok: true, results: [], stopped: null }) as unknown as SmsSendResultView);
    const user = userEvent.setup();
    renderDialog({
      recipients: [{ id: 'c1', name: 'Andrei Popescu', phone: '+37369000000', text: 'Text implicit' }],
      templates,
      defaultTemplateId: 't1',
      renderTemplate: templateId => templates.find(t => t.id === templateId)?.body ?? '',
      onSend,
    });

    await user.click(screen.getByRole('button', { name: /Trimite SMS/ }));

    expect(onSend).toHaveBeenCalledWith(['c1'], {
      templateId: 't1',
      text: 'Buna, {parinte}! Sablon restanta.',
      stripDiacritics: true,
    });
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
    expect(onRetry).toHaveBeenCalledWith(['c3', 'c4'], undefined);
  });
});
