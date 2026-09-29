import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  BnmRateLink,
  Button,
  DataTable,
  LoadingState,
  ProfileLayout,
  ProfileNotFound,
  ProfileSection,
  RowMenu,
  SearchSelect,
  StatCard,
  groupTone,
  useToast,
  type DataTableColumn,
  type PillTone,
} from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { useExchangeRates } from '@shared/api/useExchangeRates';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatRate } from '#shared/format/rate-format.mjs';
import { allocations } from '#shared/domain/payment-allocations.mjs';
import { latestKnownRate, convertAmount } from '#shared/domain/exchange-rates.mjs';
import { today } from '#shared/domain/calendar-month.mjs';
import { normalizePayerAlias } from '#shared/format/text-search.mjs';
import { useChildProfile } from './useChildProfile';
import { ChildAttendanceSection } from './ChildAttendanceSection';
import { ChildFormDrawer } from './ChildFormDrawer';
import { buildChildRecord, type ChildFormValues } from './child-form';
import type { Child, ChildNote, PayerAlias, Payment, PaymentAllocation } from '@contracts/record-types.mjs';
import type { ViewKey } from '@shared/view-key';
import styles from './ChildrenPage.module.css';

const GROUP_SQUARE_TONE_CLASS: Record<PillTone, string> = {
  orange: 'groupSquareOrange',
  mint: 'groupSquareMint',
  yellow: 'groupSquareYellow',
  pink: 'groupSquarePink',
  teal: 'groupSquareTeal',
  blue: 'groupSquareBlue',
  purple: 'groupSquarePurple',
  coral: 'groupSquareCoral',
  neutral: 'groupSquare',
};

export function ChildProfileView({
  childId,
  month,
  onBack,
  onNavigate,
}: {
  childId: string;
  month: string;
  onBack: () => void;
  onNavigate: (view: ViewKey, params?: Record<string, string>) => void;
}) {
  const profileData = useChildProfile(childId, month);
  const session = useAppSession();
  const { rates } = useExchangeRates();
  const toast = useToast();
  const navigate = useNavigate();
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [changingGroup, setChangingGroup] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [noteText, setNoteText] = useState('');

  if (profileData.status === 'loading') return <LoadingState />;
  if (profileData.status === 'failed')
    return <p className={styles.notice}>{profileData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;
  if (profileData.status === 'not-found' || !profileData.child) {
    return <ProfileNotFound back={{ label: 'Copii', onClick: onBack }} />;
  }

  const { child, obligation: childObligation } = profileData;
  const isEurChild = childObligation?.currency === 'EUR';
  const todaysRate = latestKnownRate(rates);
  const heroTone = groupTone(child.groupId, profileData.groups);
  const groupSquareTone = GROUP_SQUARE_TONE_CLASS[heroTone];

  async function changeGroup(groupId: string) {
    try {
      await session.mutate('/api/record', {
        type: 'children',
        mode: 'update',
        record: { ...child, groupId: groupId || null },
      });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
    setChangingGroup(false);
  }

  async function addNote() {
    const text = noteText.trim();
    if (!text) return;
    const note: ChildNote = { id: `NOTE-${crypto.randomUUID()}`, text, date: today() };
    try {
      await session.mutate('/api/record', {
        type: 'children',
        mode: 'update',
        record: { ...child, notes: [note, ...(child.notes ?? [])] } satisfies Child,
      });
      setNoteText('');
      setAddingNote(false);
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  // CF-2 (09-copii-fisa.md): „Plătitorii reținuți se pot șterge din fișă” — ștergere directă,
  // fără arhivare (vezi /api/payer-alias-delete din feature-ul payer-aliases).
  async function deleteAlias(alias: PayerAlias) {
    try {
      await session.mutate('/api/payer-alias-delete', { id: alias.id });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  // C1: re-aruncată după toast, ca ChildFormDrawer să știe că salvarea a eșuat.
  async function submitChildEdit(values: ChildFormValues) {
    const record = buildChildRecord(child, child.id, values);
    try {
      await session.mutate('/api/record', { type: 'children', mode: 'update', record });
    } catch (error) {
      toast.show({ message: (error as Error).message });
      throw error;
    }
    setEditDrawerOpen(false);
    toast.show({ message: 'Fișă actualizată.' });
  }

  return (
    <>
      <ProfileLayout
        back={{ label: 'Copii', onClick: onBack }}
        header={{
          name: child.name,
          tone: heroTone,
          meta: (
            <>
              Născut {child.birthDate ? formatDate(child.birthDate) : 'dată necunoscută'} · {profileData.age} · Contract{' '}
              {profileData.contractLabel}
            </>
          ),
          badges: [
            { label: child.status, tone: 'mint' },
            { label: profileData.groupName, tone: heroTone },
          ],
          actions: (
            <>
              <Button variant="white" onClick={() => setEditDrawerOpen(true)}>
                Editează fișa
              </Button>
              <Button onClick={() => navigate(`/achitari/nou?copil=${child.id}`)}>+ Plată</Button>
            </>
          ),
        }}
        left={
          <>
            {/* CF-2 (09-copii-fisa.md): data nașterii e deja în hero ("Născut ..."), nu se
                duplică aici — cardul arată doar IDNP/adresă, mereu vizibil (chiar dacă goale). */}
            <ProfileSection title="Date personale">
              <div className={styles.parentContactRow}>
                <strong>IDNP</strong>
                <span>{child.idnp || '—'}</span>
              </div>
              <div className={styles.parentContactRow}>
                <strong>Adresă</strong>
                <span>{child.address || '—'}</span>
              </div>
              {child.healthNotes && <p className={styles.healthNote}>{child.healthNotes}</p>}
            </ProfileSection>

            <ProfileSection title="Părinți">
              <ParentRow name={child.parent} phone={child.phone} onAddPhone={() => setEditDrawerOpen(true)} />
              {(child.parent2 || child.phone2) && (
                <ParentRow
                  name={child.parent2 || ''}
                  phone={child.phone2 || ''}
                  onAddPhone={() => setEditDrawerOpen(true)}
                />
              )}
            </ProfileSection>

            <ProfileSection title="Grupă și educator">
              <div className={styles.groupRow}>
                <span className={`${styles.groupSquare} ${styles[groupSquareTone]}`}>
                  {profileData.groupName.charAt(0).toUpperCase() || '—'}
                </span>
                <div className={styles.groupInfo}>
                  <strong>{profileData.groupName}</strong>
                  <small>
                    {profileData.groupMemberCount}/{profileData.group?.capacity ?? '—'} copii · Educator{' '}
                    {profileData.group?.educator || '—'}
                  </small>
                  {(profileData.group?.ageMinYears != null || profileData.group?.ageMaxYears != null) && (
                    <small className={styles.groupAges}>
                      vârste {profileData.group?.ageMinYears ?? '0'}–{profileData.group?.ageMaxYears ?? '∞'} ani
                    </small>
                  )}
                </div>
                {changingGroup ? (
                  <SearchSelect
                    ariaLabel="Schimbă grupa"
                    placeholder="Alege o grupă…"
                    value={child.groupId ?? ''}
                    onChange={value => void changeGroup(value)}
                    options={[
                      { value: '', label: 'Fără grupă' },
                      ...profileData.groups.map(group => ({ value: group.id, label: group.name })),
                    ]}
                  />
                ) : (
                  <button type="button" className={styles.sectionLink} onClick={() => setChangingGroup(true)}>
                    Schimbă
                  </button>
                )}
              </div>
            </ProfileSection>

            <ChildAttendanceSection childId={child.id} month={month} />

            <ProfileSection
              title="Note"
              action={{
                label: addingNote ? 'Anulează' : '+ Notă',
                onClick: () => {
                  setAddingNote(!addingNote);
                  setNoteText('');
                },
              }}
            >
              {addingNote && (
                <form
                  className={styles.noteForm}
                  onSubmit={event => {
                    event.preventDefault();
                    void addNote();
                  }}
                >
                  <textarea
                    rows={2}
                    autoFocus
                    value={noteText}
                    onChange={event => setNoteText(event.target.value)}
                    placeholder="Scrie o notă…"
                  />
                  <Button type="submit" disabled={!noteText.trim()}>
                    Salvează
                  </Button>
                </form>
              )}
              {(child.notes ?? []).length === 0 ? (
                <p>Nicio notă încă.</p>
              ) : (
                (child.notes ?? []).map((note, index) => (
                  <p key={note.id} className={`${styles.noteRow} ${index === 0 ? styles.noteRecent : ''}`}>
                    <span className={styles.noteDate}>{formatDate(note.date)}</span>
                    {note.text}
                  </p>
                ))
              )}
            </ProfileSection>

            <ProfileSection title="Plătitori reținuți">
              <p className={styles.aliasIntro}>
                Se adaugă automat din{' '}
                <button type="button" onClick={() => onNavigate('assign')}>
                  Asociere achitări
                </button>{' '}
                când bifezi „Ține minte plătitorul”.
              </p>
              {profileData.payerAliases.length === 0 ? (
                <p>Niciun plătitor reținut încă.</p>
              ) : (
                profileData.payerAliases.map(alias => {
                  const usageCount = profileData.payments.filter(
                    payment => normalizePayerAlias(payment.sourceName || '') === normalizePayerAlias(alias.alias),
                  ).length;
                  return (
                    <div key={alias.id} className={styles.aliasRow}>
                      <span className={styles.aliasName}>
                        <strong>{alias.alias}</strong>
                        <small>
                          din {formatDate(alias.createdAt.slice(0, 10))}
                          {usageCount > 0 ? ` · ${usageCount} achitări` : ''}
                        </small>
                      </span>
                      <button
                        type="button"
                        aria-label={`Șterge ${alias.alias}`}
                        onClick={() => void deleteAlias(alias)}
                      >
                        ×
                      </button>
                    </div>
                  );
                })
              )}
            </ProfileSection>
          </>
        }
        stats={[
          <StatCard
            key="sold"
            label="Sold"
            tone="mint"
            value={formatMoney(childObligation?.rest ?? null, childObligation?.currency)}
            sub={
              childObligation?.rest
                ? `${formatMoney(childObligation.rest, childObligation.currency)} datorie${
                    isEurChild && todaysRate
                      ? ` · ≈ ${formatMoney(convertAmount(childObligation.rest, 'EUR', 'MDL', todaysRate), 'MDL')} azi`
                      : ''
                  }${
                    childObligation.lines
                      .filter(line => line.kind !== 'fee')
                      .map(line => ` · ${line.label}`)
                      .join('') || ''
                  }`
                : 'La zi'
            }
          />,
          <StatCard
            key="fee"
            label="Taxă lunară"
            tone="yellow"
            value={formatMoney(profileData.feeEntry?.amount ?? child.fee, profileData.feeEntry?.currency ?? 'MDL')}
            sub={childObligation ? `scadență ziua ${Number(childObligation.due.slice(-2))}` : '—'}
          />,
          <StatCard
            key="contract"
            label="Contract"
            value={profileData.contractLabel}
            sub={child.contractDate ? `din ${formatDate(child.contractDate)}` : '—'}
          />,
        ]}
        right={
          <>
            <ProfileSection
              title="Istoric plăți"
              action={{ label: 'Toate achitările →', onClick: () => onNavigate('payments', { copil: child.id }) }}
            >
              <PaymentHistoryTable
                payments={profileData.payments}
                showEurColumns={isEurChild}
                onPrint={paymentId => navigate(`/achitari/${paymentId}/confirmare`)}
              />
            </ProfileSection>

            {/* CF-7 (09-copii-fisa.md): nu există stocare de documente încă — placeholder gol,
                „+ Încarcă” dezactivat, până se decide o funcție reală de upload. */}
            <ProfileSection title="Documente">
              <div className={styles.documentsGrid}>
                <span className={styles.documentSlot} />
                <span className={styles.documentSlot} />
                <span className={styles.documentSlot} />
              </div>
              <Button variant="outline" disabled title="În curând">
                + Încarcă
              </Button>
            </ProfileSection>
          </>
        }
      />

      <ChildFormDrawer
        key={editDrawerOpen ? child.id : 'closed'}
        target={editDrawerOpen ? child : null}
        groups={profileData.groups}
        onSubmit={submitChildEdit}
        onClose={() => setEditDrawerOpen(false)}
      />
    </>
  );
}

function ParentRow({ name, phone, onAddPhone }: { name: string; phone: string; onAddPhone: () => void }) {
  return (
    <div className={styles.parentContactRow}>
      <strong>{name || 'Necunoscut'}</strong>
      {phone ? (
        <span>{phone}</span>
      ) : (
        <button type="button" onClick={onAddPhone}>
          + adaugă telefon
        </button>
      )}
    </div>
  );
}

function PaymentHistoryTable({
  payments,
  showEurColumns,
  onPrint,
}: {
  payments: Payment[];
  showEurColumns: boolean;
  onPrint: (paymentId: string) => void;
}) {
  if (payments.length === 0) return <p className={styles.notice}>Fără achitări.</p>;

  const columns: DataTableColumn<Payment>[] = [
    {
      key: 'month',
      header: 'Lună',
      render: payment =>
        allocations(payment)
          .map((allocation: PaymentAllocation) => allocation.month)
          .join(', ') || 'Avans nerepartizat',
    },
    { key: 'date', header: 'Dată', render: payment => formatDate(payment.date), sortValue: payment => payment.date },
    { key: 'method', header: 'Metodă', render: payment => payment.method },
    {
      key: 'amount',
      header: 'Plătit lei',
      align: 'end',
      render: payment => formatMoney(payment.amount),
      sortValue: payment => payment.amount,
    },
    ...(showEurColumns
      ? [
          {
            key: 'fxRate',
            header: 'Curs',
            align: 'end' as const,
            render: (payment: Payment) => (
              <>
                {formatRate(payment.fxRate)}
                {payment.fxRate != null && <BnmRateLink date={payment.date} />}
              </>
            ),
          },
          {
            key: 'amountEur',
            header: 'Echivalent €',
            align: 'end' as const,
            render: (payment: Payment) => formatMoney(payment.amountEur ?? null, 'EUR'),
          },
        ]
      : []),
    {
      key: 'status',
      header: '',
      render: payment => (
        <Badge tone={payment.archived ? 'neutral' : 'mint'}>{payment.archived ? 'Arhivată' : 'Achitat'}</Badge>
      ),
    },
    {
      key: 'menu',
      header: '',
      align: 'end',
      render: payment => <RowMenu items={[{ label: 'Tipărește confirmarea', onClick: () => onPrint(payment.id) }]} />,
    },
  ];

  return <DataTable columns={columns} rows={payments} rowKey={payment => payment.id} pageSize={6} />;
}
