import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readDirtyForms } from '@shared/state/dirty-forms';
import { ToastProvider } from '@shared/ui';
import { PAYMENT_CONFIRMATION_TEMPLATE_ID } from '@domain/sms-template.mjs';
import { today as todayFn } from '@domain/calendar-month.mjs';
import { PaymentFormDrawer, type PaymentFormDrawerProps } from './PaymentFormDrawer';
import type { Payment, RecordsSnapshot } from '@contracts/record-types.mjs';

/** `useToast()` (15b) cere `ToastProvider`; §5 (PROMPT-11): cardul galben „fără plan/taxă” are un
 * `<Link>` spre fișa copilului — are nevoie de context de router, ca în `ChildFormDrawer.test.tsx`. */
function renderDrawerWithProps(props: PaymentFormDrawerProps) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <PaymentFormDrawer {...props} />
      </ToastProvider>
    </MemoryRouter>,
  );
}

// Curs cunoscut doar la o dată veche, ca eurToMdlRate să-l propună (cel mai
// recent cunoscut înaintea datei) indiferent de data „de azi” din test.
const KNOWN_RATE_DATE = '2020-01-01';
const KNOWN_RATE = 19.5;

const records = {
  children: [
    {
      id: 'c1',
      name: 'Andrei Popescu',
      archived: false,
      status: 'Activ',
      statusHistory: [{ from: '2026-01', status: 'Activ' }],
      attendanceDate: '2026-01-10',
      feeHistory: [{ from: '2026-01', amount: 1500 }],
      // 15b: telefon moldovenesc valid — sendSmsConfirmation pornește bifat pentru acest copil.
      parent: 'Maria Popescu',
      phone: '069123456',
    },
    { id: 'c2', name: 'Maria Ionescu', archived: false, feeHistory: [] },
    {
      id: 'c3',
      name: 'Elena Rusu',
      archived: false,
      feeHistory: [{ from: '2026-01', amount: 100, currency: 'EUR' }],
    },
    // 44b: frate al c1 (același telefon de părinte) — pentru testele „+ Adaugă fratele”.
    {
      id: 'c4',
      name: 'Radu Popescu',
      archived: false,
      status: 'Activ',
      statusHistory: [{ from: '2026-01', status: 'Activ' }],
      attendanceDate: '2026-01-10',
      feeHistory: [{ from: '2026-01', amount: 1200 }],
      phone: '069123456',
    },
    // §2 (VERIFICARE §4): taxă EUR a cărei conversie la cursul cunoscut lasă bani (100,03 × 19,5 =
    // 1.950,585 → 1.950,59), pentru testul de precompletare rotunjită la leu.
    {
      id: 'c5',
      name: 'Dan Cojocaru',
      archived: false,
      feeHistory: [{ from: '2026-01', amount: 100.03, currency: 'EUR' }],
    },
    // VERIFICARE-DUPA-PROMPT-8.md §4: taxa exactă din verificare (4.921,83 lei), pentru cele 4
    // cazuri de rotunjire/parțial/avans la salvare.
    {
      id: 'c6',
      name: 'Ioana Barbu',
      archived: false,
      feeHistory: [{ from: '2026-01', amount: 4921.83 }],
    },
    // F16 (PROMPT-11 §2): 650 € × 20,1068 = 13.069,42 — cazul exact din cerere, pentru pastilele
    // „Rotunjește” (în jos/în sus la leu, la 10 lei).
    {
      id: 'c7',
      name: 'Victor Marin',
      archived: false,
      feeHistory: [{ from: '2026-01', amount: 650, currency: 'EUR' }],
    },
    // §5 (PROMPT-11 F18): grupă + contract + scadență pentru cardul copilului; taxă EUR care se
    // potrivește unei presetări (`/api/plan-presets`), pentru cardul „Plan”.
    {
      id: 'c8',
      name: 'Gabriel Vasile',
      archived: false,
      groupId: 'g1',
      contractNumber: '7',
      dueDay: 15,
      feeHistory: [{ from: '2026-01', amount: 500, currency: 'EUR' }],
    },
  ],
  payments: [],
  expenses: [],
  groups: [{ id: 'g1', name: 'Fluturași', order: 1 }],
  categories: [],
  visits: [],
  charges: [],
  services: [
    { id: 'gradinita', name: 'Grădiniță', order: 0, tone: 'orange', priceMode: 'free', system: true },
    { id: 'bazin', name: 'Bazin', order: 1, tone: 'blue', priceMode: 'free', system: true },
  ],
} as unknown as RecordsSnapshot;

function renderDrawer() {
  const onSubmit = vi.fn().mockResolvedValue(true);
  const onClose = vi.fn();
  renderDrawerWithProps({ target: 'new', records, onSubmit, onClose });
  return { onSubmit, onClose };
}

function saveButton() {
  return screen.getByRole('button', { name: /^Salvează/ });
}

function sumInput() {
  return screen.getByLabelText('Sumă') as HTMLInputElement;
}

/** §5 (PROMPT-11 F18): precompletarea taxei pornește acum și la prima alegere a copilului
 * într-o plată nouă (nu doar din fișă, `defaultChildId`) — câmpul Sumă poate avea deja o
 * valoare propusă când testul vrea să scrie una proprie, de-aia golim întâi. */
async function typeSum(user: ReturnType<typeof userEvent.setup>, value: string) {
  const input = sumInput();
  await user.clear(input);
  await user.type(input, value);
}

async function pickChild(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: 'Copil' }));
  await user.click(screen.getByRole('option', { name }));
}

async function goManual(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Repartizează manual' }));
}

/** Implicit sms.md neconectat — testele 15b care au nevoie de „conectat” își suprascriu propriul fetch. */
function stubFetch({
  smsStatus = { configured: false },
  smsSend,
  planPresets = [],
}: { smsStatus?: object; smsSend?: unknown; planPresets?: unknown[] } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/exchange-rates')
        return { ok: true, status: 200, json: async () => ({ rates: { [KNOWN_RATE_DATE]: KNOWN_RATE }, sources: {} }) };
      if (path === '/api/sms-status') return { ok: true, status: 200, json: async () => smsStatus };
      if (path === '/api/sms-send' && smsSend) return { ok: true, status: 200, json: async () => smsSend };
      if (path === '/api/plan-presets') return { ok: true, status: 200, json: async () => planPresets };
      throw new Error(`neașteptat: ${path}`);
    }),
  );
}

describe('PaymentFormDrawer', () => {
  beforeEach(() => {
    stubFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('suma introdusă în câmpul Sumă e totalul folosit la repartizare și trimitere', async () => {
    const { onSubmit } = renderDrawer();
    const user = userEvent.setup();

    await typeSum(user, '500');
    expect(sumInput().value).toBe('500');

    await user.click(saveButton());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ tenders: expect.objectContaining({ Cash: '500' }) }),
    );
  });

  it('schimbarea metodei mută suma pe metoda nouă, fără să o dubleze', async () => {
    const { onSubmit } = renderDrawer();
    const user = userEvent.setup();

    await typeSum(user, '500');
    await user.click(screen.getByRole('radio', { name: 'Card' }));
    expect(sumInput().value).toBe('500');

    await user.click(saveButton());
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.tenders.Card).toBe('500');
    expect(submitted.tenders.Cash).toBe('');
  });

  it('rândul unic de repartizare urmărește suma până e editat manual', async () => {
    renderDrawer();
    const user = userEvent.setup();

    await typeSum(user, '500');
    await goManual(user);

    const allocationAmount = document.querySelector('input[type="number"][min="0.01"]') as HTMLInputElement;
    expect(allocationAmount.value).toBe('500.00');

    await user.clear(allocationAmount);
    await user.type(allocationAmount, '100');
    await user.clear(sumInput());
    await typeSum(user, '700');

    // Suma repartizării nu se mai actualizează automat după editarea manuală.
    expect(allocationAmount.value).toBe('100');
  });

  it('data încasării actualizează luna repartizării cât timp e singurul rând, neatins', async () => {
    renderDrawer();
    const user = userEvent.setup();

    await goManual(user);
    const dateInput = screen.getByLabelText('Data') as HTMLInputElement;
    const monthInput = document.querySelector('input[type="month"]') as HTMLInputElement;
    const initialMonth = monthInput.value;

    await user.clear(dateInput);
    await user.type(dateInput, '2026-11-05');

    expect(monthInput.value).not.toBe(initialMonth);
    expect(monthInput.value).toBe('2026-11');
  });

  it('F7 (FEEDBACK-01-10.md): alegerea copilului NU propune restanța — luna rămâne cea a plății', async () => {
    renderDrawer();
    const user = userEvent.setup();

    await pickChild(user, 'Andrei Popescu');
    await goManual(user);
    const monthInput = document.querySelector('input[type="month"]') as HTMLInputElement;

    expect(monthInput.value).toBe(todayFn().slice(0, 7));
  });

  it('"+ Lună" adaugă un rând nou și oprește sincronizarea automată', async () => {
    renderDrawer();
    const user = userEvent.setup();

    await goManual(user);
    await user.click(screen.getByRole('button', { name: '+ Lună' }));
    expect(document.querySelectorAll('input[type="month"]')).toHaveLength(2);
  });

  it('onSubmit primește valorile curente ale formularului', async () => {
    const { onSubmit } = renderDrawer();
    const user = userEvent.setup();

    await pickChild(user, 'Maria Ionescu');
    await typeSum(user, '500');
    await user.click(saveButton());

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ childId: 'c2', tenders: expect.objectContaining({ Cash: '500' }) }),
    );
  });

  it('la editare, o repartizare parțială (avans) nu este suprascrisă automat la deschidere', async () => {
    const payment = {
      id: 'p1',
      childId: 'c1',
      date: '2026-09-10',
      tenders: [{ method: 'Cash', amount: 1000 }],
      allocations: [{ month: '2026-09', amount: 600 }],
      sourceName: '',
      reviewed: false,
      notes: '',
    } as unknown as Payment;

    renderDrawerWithProps({ target: payment, records, onSubmit: vi.fn().mockResolvedValue(true), onClose: vi.fn() });
    const user = userEvent.setup();
    await goManual(user);

    const allocationAmount = document.querySelector('input[type="number"][min="0.01"]') as HTMLInputElement;
    expect(allocationAmount.value).toBe('600');
  });

  it('apelează onSubmit o singură dată la dublu-click rapid pe Salvează', async () => {
    let resolveSubmit!: (value: boolean) => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<boolean>(resolve => {
          resolveSubmit = resolve;
        }),
    );
    renderDrawerWithProps({ target: 'new', records, onSubmit, onClose: vi.fn() });
    const user = userEvent.setup();

    await typeSum(user, '500');
    const button = saveButton();

    await user.click(button);
    await user.click(button);
    resolveSubmit(true);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('F7: defaultChildId la o plată nouă pornește tot pe luna plății, nu pe restanță', async () => {
    renderDrawerWithProps({
      target: 'new',
      records,
      defaultChildId: 'c1',
      onSubmit: vi.fn().mockResolvedValue(true),
      onClose: vi.fn(),
    });
    const user = userEvent.setup();
    await goManual(user);

    const monthInput = document.querySelector('input[type="month"]') as HTMLInputElement;
    expect(monthInput.value).toBe(todayFn().slice(0, 7));
  });

  it('F11: defaultChildId precompletează suma cu taxa lunii (copil MDL)', async () => {
    renderDrawerWithProps({
      target: 'new',
      records,
      defaultChildId: 'c1',
      onSubmit: vi.fn().mockResolvedValue(true),
      onClose: vi.fn(),
    });
    expect(await screen.findByDisplayValue('1500.00')).toBeInTheDocument();
  });

  it('F11: defaultChildId precompletează suma la cursul zilei (copil EUR)', async () => {
    renderDrawerWithProps({
      target: 'new',
      records,
      defaultChildId: 'c3',
      onSubmit: vi.fn().mockResolvedValue(true),
      onClose: vi.fn(),
    });
    // 100 € × 19,5 (cursul cunoscut) = 1.950,00 lei.
    expect(await screen.findByDisplayValue('1950.00')).toBeInTheDocument();
  });

  it('F11 + §2 (VERIFICARE §4): conversia EUR cu bani se precompletează cu suma exactă, nerotunjită', async () => {
    renderDrawerWithProps({
      target: 'new',
      records,
      defaultChildId: 'c5',
      onSubmit: vi.fn().mockResolvedValue(true),
      onClose: vi.fn(),
    });
    // 100,03 € × 19,5 = 1.950,585 lei → exact 1.950,59 (R: 02.10, nu mai rotunjește la leu).
    expect(await screen.findByDisplayValue('1950.59')).toBeInTheDocument();
    expect(screen.getByText(/100,03 €.*1\.950,59 lei/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Exact 1950,59' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'în sus la leu' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'în sus la leu' }));
    expect(screen.getByDisplayValue('1951.00')).toBeInTheDocument();
  });

  it('F11: suma precompletată rămâne editabilă', async () => {
    renderDrawerWithProps({
      target: 'new',
      records,
      defaultChildId: 'c1',
      onSubmit: vi.fn().mockResolvedValue(true),
      onClose: vi.fn(),
    });
    await screen.findByDisplayValue('1500.00');
    const user = userEvent.setup();
    await user.clear(sumInput());
    await typeSum(user, '2000');
    expect(sumInput().value).toBe('2000');
  });

  it('eliminarea unui rând de repartizare păstrează valorile celui rămas', async () => {
    renderDrawer();
    const user = userEvent.setup();

    await goManual(user);
    await user.click(screen.getByRole('button', { name: '+ Lună' }));
    const amountInputs = () =>
      Array.from(document.querySelectorAll('input[type="number"][min="0.01"]')) as HTMLInputElement[];

    await user.type(amountInputs()[0], '111');
    await user.type(amountInputs()[1], '222');

    const removeButtons = screen.getAllByRole('button', { name: 'Elimină repartizarea' });
    await user.click(removeButtons[0]);

    expect(amountInputs()).toHaveLength(1);
    expect(amountInputs()[0].value).toBe('222');
  });

  it('copil cu taxă MDL: fără câmp de curs EUR, iar fxRate/amountEur rămân absente la trimitere', async () => {
    const { onSubmit } = renderDrawer();
    const user = userEvent.setup();

    await pickChild(user, 'Andrei Popescu');
    await typeSum(user, '500');
    await user.click(saveButton());

    expect(screen.queryByLabelText('Curs EUR')).toBeNull();
    const submitted = onSubmit.mock.calls[0][0];
    expect('fxRate' in submitted).toBe(false);
    expect('fxRateSource' in submitted).toBe(false);
    expect('amountEur' in submitted).toBe(false);
  });

  it('copil cu taxă EUR: arată conversia în €, câmpul Curs EUR, și trimite fxRate/amountEur', async () => {
    const { onSubmit } = renderDrawer();
    const user = userEvent.setup();

    await pickChild(user, 'Elena Rusu');
    await typeSum(user, '1000');

    expect(screen.getByText('= 51,28 €')).toBeInTheDocument();
    expect(screen.getByLabelText('Curs EUR')).toHaveAttribute('placeholder', String(KNOWN_RATE));

    await user.click(saveButton());

    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.fxRate).toBe(KNOWN_RATE);
    expect(submitted.fxRateSource).toBe('bnm');
    expect(submitted.amountEur).toBeCloseTo(51.28, 2);
  });

  it('un curs manual introdus în Curs EUR schimbă fxRate-ul (și amountEur-ul) trimis', async () => {
    const { onSubmit } = renderDrawer();
    const user = userEvent.setup();

    await pickChild(user, 'Elena Rusu');
    await typeSum(user, '1000');
    await user.type(screen.getByLabelText('Curs EUR'), '20');

    await user.click(saveButton());

    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.fxRate).toBe(20);
    expect(submitted.fxRateSource).toBe('manual');
    expect(submitted.amountEur).toBeCloseTo(50, 2);
  });

  // VERIFICARE-DUPA-PROMPT-8.md §4, cele 4 cazuri exacte (taxă 4.921,83 lei, copilul c6).
  describe('§2 (PROMPT-10, DECIZII 02.10): roundingDiff la o plată cu bănuți', () => {
    it('încasat 4.920 (sub 4.921,83) — achitat cu rotunjire −1,83', async () => {
      const { onSubmit } = renderDrawer();
      const user = userEvent.setup();
      await pickChild(user, 'Ioana Barbu');
      await typeSum(user, '4920');
      await user.click(saveButton());

      const submitted = onSubmit.mock.calls[0][0];
      expect(submitted.roundingDiff).toBeCloseTo(-1.83);
      expect(submitted.allocations).toHaveLength(1);
    });

    it('încasat 4.922 (rotunjitul precompletat) — achitat cu rotunjire +0,17', async () => {
      const { onSubmit } = renderDrawer();
      const user = userEvent.setup();
      await pickChild(user, 'Ioana Barbu');
      await typeSum(user, '4922');
      await user.click(saveButton());

      const submitted = onSubmit.mock.calls[0][0];
      expect(submitted.roundingDiff).toBeCloseTo(0.17);
      expect(submitted.allocations).toHaveLength(1);
    });

    it('încasat 4.900 (diferență 21,83, peste toleranță) — fără roundingDiff, rămâne restanță', async () => {
      const { onSubmit } = renderDrawer();
      const user = userEvent.setup();
      await pickChild(user, 'Ioana Barbu');
      await typeSum(user, '4900');
      await user.click(saveButton());

      const submitted = onSubmit.mock.calls[0][0];
      expect(submitted.roundingDiff).toBeUndefined();
      expect(submitted.allocations).toMatchObject([{ amount: '4900.00' }]);
    });

    // F16 (PROMPT-11 §2): 650 € × 20,1068 = 13.069,42 — pastilele „Rotunjește” aleg rotunjirea,
    // nu o rotunjire automată tăcută la precompletare.
    function stubFetchWithRate201068() {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (path: string) => {
          if (path === '/api/exchange-rates')
            return {
              ok: true,
              status: 200,
              json: async () => ({ rates: { [KNOWN_RATE_DATE]: 20.1068 }, sources: {} }),
            };
          if (path === '/api/sms-status') return { ok: true, status: 200, json: async () => ({ configured: false }) };
          throw new Error(`neașteptat: ${path}`);
        }),
      );
    }

    it('650 € la 20,1068: „în sus la leu” dă 13.070 lei, roundingDiff +0,58', async () => {
      stubFetchWithRate201068();
      const { onSubmit } = renderDrawer();
      const user = userEvent.setup();
      await pickChild(user, 'Victor Marin');
      await typeSum(user, '13069.42');

      await user.click(screen.getByRole('radio', { name: 'în sus la leu' }));
      expect(sumInput().value).toBe('13070');

      await user.click(saveButton());
      const submitted = onSubmit.mock.calls[0][0];
      expect(submitted.roundingDiff).toBeCloseTo(0.58);
    });

    it('650 € la 20,1068: „în jos la leu” dă 13.069 lei, roundingDiff −0,42', async () => {
      stubFetchWithRate201068();
      const { onSubmit } = renderDrawer();
      const user = userEvent.setup();
      await pickChild(user, 'Victor Marin');
      await typeSum(user, '13069.42');

      await user.click(screen.getByRole('radio', { name: 'în jos la leu' }));
      expect(sumInput().value).toBe('13069');

      await user.click(saveButton());
      const submitted = onSubmit.mock.calls[0][0];
      expect(submitted.roundingDiff).toBeCloseTo(-0.42);
    });

    it('încasat 5.000 (peste toleranță) — fără roundingDiff, avans pe luna următoare', async () => {
      const { onSubmit } = renderDrawer();
      const user = userEvent.setup();
      await pickChild(user, 'Ioana Barbu');
      await typeSum(user, '5000');
      await user.click(saveButton());

      const submitted = onSubmit.mock.calls[0][0];
      expect(submitted.roundingDiff).toBeUndefined();
      expect(submitted.allocations).toHaveLength(2);
    });
  });

  it('fără curs cunoscut și fără curs manual, trimiterea unei plăți pe copil cu taxă EUR este blocată', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        if (path === '/api/exchange-rates')
          return { ok: true, status: 200, json: async () => ({ rates: {}, sources: {} }) };
        throw new Error(`neașteptat: ${path}`);
      }),
    );
    const { onSubmit } = renderDrawer();
    const user = userEvent.setup();

    await pickChild(user, 'Elena Rusu');
    await typeSum(user, '1000');

    expect(screen.getByText('Curs necunoscut pentru această dată — completează manual')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    await user.click(saveButton());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('formularul devine „nesalvat” după prima modificare și save() întoarce true la salvare reușită', async () => {
    const { onSubmit } = renderDrawer();
    const user = userEvent.setup();

    expect(readDirtyForms()).toEqual([]);

    await typeSum(user, '500');

    const [dirtyForm] = readDirtyForms();
    expect(dirtyForm.label).toBe('o achitare');

    await expect(dirtyForm.save()).resolves.toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('save() întoarce false când mutația pică (C1) — „Salvează și schimbă” nu are voie să schimbe filiala', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Verifică operațiunea anterioară.'));
    renderDrawerWithProps({ target: 'new', records, onSubmit, onClose: vi.fn() });
    const user = userEvent.setup();

    await typeSum(user, '500');
    const [dirtyForm] = readDirtyForms();

    await expect(dirtyForm.save()).resolves.toBe(false);
  });

  it('formularul nu e nesalvat cât timp drawer-ul e închis (target null)', () => {
    renderDrawerWithProps({ target: null, records, onSubmit: vi.fn(), onClose: vi.fn() });
    expect(readDirtyForms()).toEqual([]);
  });

  it('A3b: „Plătitor” cu placeholder, „Observații” ascunse în spatele unui link', async () => {
    const { onSubmit } = renderDrawer();
    const user = userEvent.setup();

    expect(screen.queryByLabelText('Observații')).not.toBeInTheDocument();
    const payerInput = screen.getByLabelText('Plătitor');
    expect(payerInput).toHaveAttribute('placeholder', 'Numele din extras, dacă diferă de părinte');
    await user.type(payerInput, 'Ion Pop');

    await user.click(screen.getByRole('button', { name: '+ Adaugă observație' }));
    await user.type(screen.getByLabelText('Observații'), 'Plătit prin cineva de încredere');

    await pickChild(user, 'Andrei Popescu');
    await user.click(saveButton());

    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.sourceName).toBe('Ion Pop');
    expect(submitted.notes).toBe('Plătit prin cineva de încredere');
  });

  it('scurtăturile de lună precompletează suma din taxa copilului', async () => {
    const { onSubmit } = renderDrawer();
    const user = userEvent.setup();

    await pickChild(user, 'Andrei Popescu');
    await user.click(screen.getByRole('radio', { name: '2 luni · 3.000' }));

    expect(sumInput().value).toBe('3000');

    await user.click(saveButton());
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.tenders.Cash).toBe('3000');
  });

  it('F7: o plată dublă se repartizează automat pe luna plății + luna următoare (avans)', async () => {
    const { onSubmit } = renderDrawer();
    const user = userEvent.setup();

    await pickChild(user, 'Andrei Popescu');
    await typeSum(user, '3000');
    await user.click(saveButton());

    const submitted = onSubmit.mock.calls[0][0];
    const paymentMonth = todayFn().slice(0, 7);
    expect(submitted.allocations).toHaveLength(2);
    expect(submitted.allocations[0]).toMatchObject({ month: paymentMonth, amount: '1500.00' });
    expect(submitted.allocations[1].amount).toBe('1500.00');
    expect(submitted.allocations[1].month > paymentMonth).toBe(true);
  });

  it('F7: restanța apare ca rând separat, nebifată — nu intră în repartizare dacă nu e bifată', async () => {
    const { onSubmit } = renderDrawer();
    const user = userEvent.setup();

    await pickChild(user, 'Andrei Popescu');
    expect(screen.getByText(/Are restanță: Ian 2026/)).toBeInTheDocument();

    await typeSum(user, '1500');
    await user.click(saveButton());

    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.allocations).toHaveLength(1);
    expect(submitted.allocations[0].month).toBe(todayFn().slice(0, 7));
  });

  it('40a: defaultCheckArrears bifează automat restanța copilului presetat (spre deosebire de F11)', async () => {
    renderDrawerWithProps({
      target: 'new',
      records,
      defaultChildId: 'c1',
      defaultCheckArrears: true,
      onSubmit: vi.fn().mockResolvedValue(true),
      onClose: vi.fn(),
    });

    expect(
      await screen.findByRole('checkbox', { name: 'Acoperă restanța din Ian 2026', checked: true }),
    ).toBeInTheDocument();
  });

  it('fără defaultCheckArrears (F11), restanța copilului presetat rămâne nebifată', async () => {
    renderDrawerWithProps({
      target: 'new',
      records,
      defaultChildId: 'c1',
      onSubmit: vi.fn().mockResolvedValue(true),
      onClose: vi.fn(),
    });

    expect(
      await screen.findByRole('checkbox', { name: 'Acoperă restanța din Ian 2026', checked: false }),
    ).toBeInTheDocument();
  });

  it('F7: bifarea restanței o include în repartizare, înaintea lunii plății', async () => {
    const { onSubmit } = renderDrawer();
    const user = userEvent.setup();

    await pickChild(user, 'Andrei Popescu');
    await user.click(screen.getByRole('checkbox', { name: 'Acoperă restanța din Ian 2026' }));
    await typeSum(user, '1500');
    await user.click(saveButton());

    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.allocations).toHaveLength(1);
    expect(submitted.allocations[0]).toMatchObject({ month: '2026-01', amount: '1500.00' });
  });

  it('B3: câmpul Serviciu apare sub Copil, implicit pe Grădiniță', async () => {
    const { onSubmit } = renderDrawer();
    const user = userEvent.setup();

    const serviceGroup = screen.getByRole('radiogroup', { name: 'Serviciu' });
    expect(within(serviceGroup).getByRole('radio', { name: 'Grădiniță' })).toHaveAttribute('aria-checked', 'true');
    expect(within(serviceGroup).getByRole('radio', { name: 'Bazin' })).toHaveAttribute('aria-checked', 'false');

    await typeSum(user, '500');
    await user.click(saveButton());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ service: 'gradinita' }));
  });

  it('B3: la Bazin dispar scurtăturile de lună și apare „restul lunii” din charges', async () => {
    // Aceeași formulă ca `today()` din calendar-month.mjs (ora locală, nu UTC) — data implicită
    // a formularului trebuie să cadă în aceeași lună ca taxa de bazin din fixtură.
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const recordsWithCharge = {
      ...records,
      charges: [
        {
          id: `CHG-bazin-c1-${currentMonth}`,
          childId: 'c1',
          month: currentMonth,
          kind: 'bazin',
          label: `Bazin ${currentMonth}: 3 × 150 lei`,
          amount: 450,
          currency: 'MDL',
          date: `${currentMonth}-15`,
        },
      ],
    } as unknown as RecordsSnapshot;
    const onSubmit = vi.fn().mockResolvedValue(true);
    renderDrawerWithProps({ target: 'new', records: recordsWithCharge, onSubmit, onClose: vi.fn() });
    const user = userEvent.setup();

    await pickChild(user, 'Andrei Popescu');
    await user.click(screen.getByRole('radio', { name: 'Bazin' }));

    expect(screen.queryByRole('radio', { name: /luni ·/ })).toBeNull();
    expect(screen.queryByRole('radio', { name: /^1 lună ·/ })).toBeNull();
    const shortcut = screen.getByRole('radio', { name: 'restul lunii · 450' });
    await user.click(shortcut);
    expect(sumInput().value).toBe('450');

    await user.click(saveButton());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ service: 'bazin' }));
  });

  describe('15b: confirmare plată prin SMS', () => {
    it('bifa pornește bifată pentru un copil cu telefon valid', async () => {
      stubFetch({ smsStatus: { configured: true } });
      renderDrawer();
      const user = userEvent.setup();

      await pickChild(user, 'Andrei Popescu');
      expect(screen.getByRole('checkbox', { name: 'Trimite confirmare părintelui prin SMS' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
    });

    it('bifa pornește debifată pentru un copil fără telefon valid', async () => {
      stubFetch({ smsStatus: { configured: true } });
      renderDrawer();
      const user = userEvent.setup();

      await pickChild(user, 'Maria Ionescu');
      expect(screen.getByRole('checkbox', { name: 'Trimite confirmare părintelui prin SMS' })).toHaveAttribute(
        'aria-checked',
        'false',
      );
    });

    it('cu sms.md neconectat, bifa e dezactivată și arată „SMS neconectat” cu link „Conectează”', () => {
      renderDrawer();
      expect(screen.getByRole('checkbox', { name: 'Trimite confirmare părintelui prin SMS' })).toBeDisabled();
      expect(screen.getByText(/SMS neconectat/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Conectează' })).toHaveAttribute('href', '/de-notificat');
    });

    it('salvarea cu bifa activă trimite SMS de confirmare cu șablonul „Confirmare plată”', async () => {
      let sendBody: {
        source: string;
        templateId: string;
        messages: { childId: string; phone: string; text: string }[];
      } | null = null;
      stubFetch({
        smsStatus: { configured: true },
        smsSend: {
          ok: true,
          results: [{ childId: 'c1', outcome: 'sent', logId: 1, segments: 1, cost: '0.30', error: '' }],
          stopped: null,
        },
      });
      const { onSubmit } = renderDrawer();
      const user = userEvent.setup();

      await pickChild(user, 'Andrei Popescu');
      await typeSum(user, '500');
      await user.click(saveButton());

      await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
      await vi.waitFor(() => {
        const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
        const sendCall = calls.find(call => call[0] === '/api/sms-send');
        expect(sendCall).toBeDefined();
        sendBody = JSON.parse((sendCall![1] as RequestInit).body as string);
      });

      expect(sendBody).toMatchObject({
        source: 'notify',
        templateId: PAYMENT_CONFIRMATION_TEMPLATE_ID,
        messages: [{ childId: 'c1', phone: '+37369123456' }],
      });
      expect(sendBody!.messages[0].text).toContain('Andrei Popescu');
      expect(sendBody!.messages[0].text).toContain('Maria Popescu');
    });

    it('bifa activă fără telefon valid nu trimite SMS și arată un toast', async () => {
      stubFetch({ smsStatus: { configured: true } });
      renderDrawer();
      const user = userEvent.setup();

      await pickChild(user, 'Maria Ionescu');
      await user.click(screen.getByRole('checkbox', { name: 'Trimite confirmare părintelui prin SMS' }));
      await typeSum(user, '500');
      await user.click(saveButton());

      await screen.findByText('Confirmarea nu s-a trimis: fără telefon valid.');
      const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.some(call => call[0] === '/api/sms-send')).toBe(false);
    });
  });

  describe('40c: confirmare la închidere cu modificări nesalvate', () => {
    it('fără modificări, × / Esc / fundalul închid direct, fără dialog', async () => {
      const { onClose } = renderDrawer();
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Închide' }));
      expect(onClose).toHaveBeenCalledOnce();
      expect(screen.queryByText(/^Renunți la modificările/)).not.toBeInTheDocument();
    });

    it('×, cu modificări nesalvate, nu închide direct — arată UnsavedChangesDialog', async () => {
      const { onClose } = renderDrawer();
      const user = userEvent.setup();
      await typeSum(user, '500');

      await user.click(screen.getByRole('button', { name: 'Închide' }));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog', { name: 'Renunți la modificările din achitarea nouă?' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Renunță' }));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('Esc, cu modificări nesalvate, arată dialogul — „Rămân” nu închide drawer-ul', async () => {
      const { onClose } = renderDrawer();
      const user = userEvent.setup();
      await typeSum(user, '500');

      await user.keyboard('{Escape}');
      expect(screen.getByRole('dialog', { name: 'Renunți la modificările din achitarea nouă?' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Rămân' }));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByText(/^Renunți la modificările/)).not.toBeInTheDocument();
    });

    it('clicul pe fundal, cu modificări nesalvate, arată dialogul în loc să închidă', async () => {
      const { onClose } = renderDrawer();
      const user = userEvent.setup();
      await typeSum(user, '500');

      await user.click(screen.getByRole('dialog', { name: 'Achitare nouă' }).parentElement!);
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog', { name: 'Renunți la modificările din achitarea nouă?' })).toBeInTheDocument();
    });

    it('„Salvez și continui” salvează formularul, apoi închide drawer-ul', async () => {
      const { onSubmit, onClose } = renderDrawer();
      const user = userEvent.setup();
      await typeSum(user, '500');

      await user.click(screen.getByRole('button', { name: 'Închide' }));
      await user.click(screen.getByRole('button', { name: 'Salvez și continui' }));

      await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
      await vi.waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    });

    it('câmpurile schimbate apar numite în dialog (suma modifică și repartizarea automată)', async () => {
      renderDrawer();
      const user = userEvent.setup();
      await typeSum(user, '500');

      await user.click(screen.getByRole('button', { name: 'Închide' }));
      expect(screen.getByText('Câmpuri modificate: suma, repartizarea.')).toBeInTheDocument();
    });
  });

  describe('44b: frați într-o plată', () => {
    it('fără frați (același telefon de părinte), linkul „+ Adaugă fratele” nu apare', async () => {
      renderDrawer();
      const user = userEvent.setup();
      await pickChild(user, 'Maria Ionescu');
      expect(screen.queryByText(/Adaugă fratele/)).not.toBeInTheDocument();
    });

    it('„+ Adaugă fratele” adaugă rândul bifat, cu suma implicită a taxei lui', async () => {
      renderDrawer();
      const user = userEvent.setup();
      await pickChild(user, 'Andrei Popescu');

      const addSiblingLink = screen.getByRole('button', { name: /Adaugă fratele \(Radu Popescu\)/ });
      await user.click(addSiblingLink);

      expect(screen.getByRole('checkbox', { name: 'Include pe Radu Popescu în plată' })).toBeChecked();
      expect(screen.getByText('Radu Popescu')).toBeInTheDocument();
      expect(screen.getByLabelText('Suma pentru Radu Popescu')).toHaveValue(1200);
      // Odată adăugat, linkul dispare — nu mai sunt alți frați disponibili.
      expect(screen.queryByText(/Adaugă fratele/)).not.toBeInTheDocument();
    });

    it('debifarea unui frate îl scoate din grup fără să-i șteargă rândul', async () => {
      renderDrawer();
      const user = userEvent.setup();
      await pickChild(user, 'Andrei Popescu');
      await user.click(screen.getByRole('button', { name: /Adaugă fratele \(Radu Popescu\)/ }));

      await user.click(screen.getByRole('checkbox', { name: 'Include pe Radu Popescu în plată' }));
      expect(screen.getByRole('checkbox', { name: 'Include pe Radu Popescu în plată' })).not.toBeChecked();
      expect(screen.getByText('Radu Popescu')).toBeInTheDocument();
    });

    it('eliminarea unui frate îi șterge rândul și readuce linkul „+ Adaugă fratele”', async () => {
      renderDrawer();
      const user = userEvent.setup();
      await pickChild(user, 'Andrei Popescu');
      await user.click(screen.getByRole('button', { name: /Adaugă fratele \(Radu Popescu\)/ }));

      await user.click(screen.getByRole('button', { name: 'Elimină Radu Popescu din plată' }));
      expect(screen.queryByText('Radu Popescu')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Adaugă fratele \(Radu Popescu\)/ })).toBeInTheDocument();
    });

    it('la trimitere, onSubmit primește frații bifați cu un receiptGroupId comun', async () => {
      const { onSubmit } = renderDrawer();
      const user = userEvent.setup();
      await pickChild(user, 'Andrei Popescu');
      await typeSum(user, '500');
      await user.click(screen.getByRole('button', { name: /Adaugă fratele \(Radu Popescu\)/ }));

      await user.click(saveButton());

      await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
      const sent = onSubmit.mock.calls[0][0];
      expect(sent.siblings).toEqual([{ childId: 'c4', month: expect.any(String), amount: '1200.00' }]);
      expect(sent.receiptGroupId).toMatch(/^GRP-/);
    });

    it('fără niciun frate bifat, onSubmit nu primește receiptGroupId', async () => {
      const { onSubmit } = renderDrawer();
      const user = userEvent.setup();
      await pickChild(user, 'Andrei Popescu');
      await typeSum(user, '500');

      await user.click(saveButton());

      await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
      expect(onSubmit.mock.calls[0][0].siblings).toEqual([]);
      expect(onSubmit.mock.calls[0][0].receiptGroupId).toBeUndefined();
    });

    it('„Total grup” editabil ajustează suma principală, nu pe a fratelui', async () => {
      renderDrawer();
      const user = userEvent.setup();
      await pickChild(user, 'Andrei Popescu');
      await typeSum(user, '500');
      await user.click(screen.getByRole('button', { name: /Adaugă fratele \(Radu Popescu\)/ }));

      // Total grup = 500 (principal) + 1200 (Radu) = 1700.
      const totalInput = screen.getByLabelText('Total grup') as HTMLInputElement;
      expect(totalInput).toHaveValue(1700);

      await user.clear(totalInput);
      await user.type(totalInput, '1800');

      expect(sumInput()).toHaveValue(600);
      expect(screen.getByLabelText('Suma pentru Radu Popescu')).toHaveValue(1200);
    });
  });

  it('§7 (PROMPT-11): fără servicii active, rândul Serviciu rămâne vizibil cu link spre setări', () => {
    renderDrawerWithProps({
      target: 'new',
      records: { ...records, services: [] },
      onSubmit: vi.fn().mockResolvedValue(true),
      onClose: vi.fn(),
    });
    expect(screen.getByText('Serviciu')).toBeInTheDocument();
    expect(screen.getByText(/Fără servicii active/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Setează serviciile' })).toBeInTheDocument();
  });

  describe('§5 (PROMPT-11 F18): cardul copilului și cardurile Plan/Curs BNM (15b)', () => {
    it('cardul copilului arată grupa, contractul și scadența (nu taxa)', async () => {
      renderDrawer();
      const user = userEvent.setup();
      await pickChild(user, 'Gabriel Vasile');

      expect(screen.getByText(/Fluturași.*contract 7.*scadență 15/)).toBeInTheDocument();
    });

    it('cu plan: cardurile Plan și Curs BNM arată presetarea, taxa și cursul', async () => {
      stubFetch({ planPresets: [{ id: 'p1', name: 'Program mediu', priceEur: 500 }] });
      renderDrawer();
      const user = userEvent.setup();
      await pickChild(user, 'Gabriel Vasile');

      expect(await screen.findByText(/Program mediu.*500,00 €/)).toBeInTheDocument();
      expect(screen.getByText('pe lună')).toBeInTheDocument();
      expect(screen.getByText(new RegExp(`1 € = ${KNOWN_RATE.toFixed(4).replace('.', ',')} lei`))).toBeInTheDocument();
    });

    it('copil cu taxă MDL arată doar cardul Plan (fără Curs BNM)', async () => {
      renderDrawer();
      const user = userEvent.setup();
      await pickChild(user, 'Andrei Popescu');

      const planCard = screen.getByText('Taxă').parentElement;
      expect(planCard).toHaveTextContent('1.500,00 lei');
      expect(screen.queryByText(/Curs BNM/)).not.toBeInTheDocument();
    });

    it('copil fără plan sau taxă arată cardul de avertizare cu link spre fișă', async () => {
      renderDrawer();
      const user = userEvent.setup();
      await pickChild(user, 'Maria Ionescu');

      expect(screen.getByText('Copilul nu are plan sau taxă')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Completează' })).toHaveAttribute('href', '/copii/c2');
    });
  });
});
