import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  BnmRateLink,
  Button,
  DataTable,
  EMPTY_STATES,
  EmptyState,
  IconButton,
  LoadingState,
  MissingFieldsBanner,
  ProfileLayout,
  ProfileNotFound,
  ProfileSection,
  RowMenu,
  SearchSelect,
  StatCard,
  TextArea,
  Timeline,
  groupTone,
  resolveEmptyStateTitle,
  useToast,
  type DataTableColumn,
  type PillTone,
  type TimelineEntry,
} from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { useExchangeRates } from '@shared/api/useExchangeRates';
import { useSyncStatus } from '@shared/api/useSyncStatus';
import { useAuditLog, type AuditScopeEntry } from '@shared/audit-log';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { formatRate } from '#shared/format/rate-format.mjs';
import { ACCESS_WRITE, isModuleAllowed } from '#shared/domain/computer-profile.mjs';
import { allocations } from '#shared/domain/payment-allocations.mjs';
import { missingChildFields } from '#shared/domain/missing-child-fields.mjs';
import { latestKnownRate, convertAmount } from '#shared/domain/exchange-rates.mjs';
import { today } from '#shared/domain/calendar-month.mjs';
import { normalizePayerAlias } from '#shared/format/text-search.mjs';
import { useChildProfile } from './useChildProfile';
import { ChildAttendanceSection } from './ChildAttendanceSection';
import { ChildFormDrawer } from './ChildFormDrawer';
import { buildChildRecord, type ChildFormValues } from './child-form';
import type {
  Child,
  ChildNote,
  PayerAlias,
  PickupPerson,
  Payment,
  PaymentAllocation,
} from '@contracts/record-types.mjs';
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
  const sync = useSyncStatus();
  const toast = useToast();
  const navigate = useNavigate();
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [changingGroup, setChangingGroup] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // 45b (PROMPT-8 §14): „Ultimele modificări" — fișa + achitările ei („înregistrările legate",
  // ca la 45a). `[]` ține `useAuditLog` în așteptare cât timp fișa încă se încarcă (nu cere
  // istoricul global doar ca să-l arunce imediat ce `childId` e cunoscut).
  const historyScope: AuditScopeEntry[] = useMemo(() => {
    if (!profileData.child) return [];
    return [
      { recordType: 'children', recordId: profileData.child.id },
      ...profileData.payments.map(payment => ({ recordType: 'payments', recordId: payment.id })),
    ];
  }, [profileData.child, profileData.payments]);
  const historyData = useAuditLog(historyScope);

  if (profileData.status === 'loading') return <LoadingState />;
  if (profileData.status === 'failed')
    return <p className={styles.notice}>{profileData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;
  if (profileData.status === 'not-found' || !profileData.child) {
    return <ProfileNotFound back={{ label: 'Copii', onClick: onBack }} />;
  }

  const { child, obligation: childObligation } = profileData;
  const missingFields = missingChildFields(child);
  // §5.3 (36e, COMPONENTE.md §230 — „RecentChanges … doar profil Complet”): fișa rămâne doar
  // pentru citire pe profilurile restrânse (Educator/Recepție/Bazin au `children` la Vede, nu
  // Modifică) — fără butoane de editare. Secțiunile de plăți dispar separat, după modulul
  // `payments` (serverul oricum nu mai trimite pe acest calculator plățile/feeHistory/healthNotes
  // când `payments` e la 0 — vezi CHILDREN_FIELDS_HIDDEN_WITHOUT_PAYMENTS — aici doar ne asigurăm
  // că nici acțiunile din jurul lor nu mai apar).
  const canEditChild = isModuleAllowed(session.state.profile, 'children', ACCESS_WRITE);
  const canWritePayments = isModuleAllowed(session.state.profile, 'payments', ACCESS_WRITE);
  const canViewPayments = isModuleAllowed(session.state.profile, 'payments');
  // 45b (COMPONENTE.md): „Ultimele modificări” rămâne doar pe profilul Complet, ca și ecranul
  // Istoric (36g) de care depinde — celelalte profiluri nu primesc deloc `audit_log` la sincronizare.
  const showHistory = isModuleAllowed(session.state.profile, 'admin');
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
    const note: ChildNote = { id: `NOTE-${crypto.randomUUID()}`, text, date: today(), author: sync.deviceName || '' };
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

  async function saveNoteEdit(note: ChildNote) {
    const text = editingNoteText.trim();
    if (!text) return;
    try {
      await session.mutate('/api/record', {
        type: 'children',
        mode: 'update',
        record: {
          ...child,
          notes: (child.notes ?? []).map(entry =>
            entry.id === note.id ? { ...entry, text, updatedAt: new Date().toISOString() } : entry,
          ),
        } satisfies Child,
      });
      setEditingNoteId(null);
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function setNoteDeleted(note: ChildNote, deletedAt: string | null) {
    try {
      await session.mutate('/api/record', {
        type: 'children',
        mode: 'update',
        record: {
          ...child,
          notes: (child.notes ?? []).map(entry => (entry.id === note.id ? { ...entry, deletedAt } : entry)),
        } satisfies Child,
      });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function deleteNote(note: ChildNote) {
    await setNoteDeleted(note, new Date().toISOString());
    toast.show({
      message: 'Notă ștearsă.',
      actionLabel: 'Anulează',
      onAction: () => void setNoteDeleted(note, null),
    });
  }

  // CF-2 (09-copii-fisa.md): „Plătitorii reținuți se pot șterge din fișă” — ștergere directă,
  // fără arhivare (vezi /api/payer-alias-delete din feature-ul payer-aliases). „Anulează” re-creează
  // aliasul cu același id, prin /api/record (create), pentru că nu există pas de arhivare aici.
  async function deleteAlias(alias: PayerAlias) {
    try {
      await session.mutate('/api/payer-alias-delete', { id: alias.id });
      toast.show({
        message: 'Plătitor șters.',
        actionLabel: 'Anulează',
        onAction: () => void session.mutate('/api/record', { type: 'payerAliases', mode: 'create', record: alias }),
      });
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
            ...(canEditChild ? [] : [{ label: 'Doar citire', tone: 'neutral' as const }]),
          ],
          actions:
            canEditChild || canWritePayments ? (
              <>
                {canEditChild && (
                  <Button variant="white" onClick={() => setEditDrawerOpen(true)}>
                    Editează fișa
                  </Button>
                )}
                {canWritePayments && <Button onClick={() => navigate(`/achitari/nou?copil=${child.id}`)}>+ Plată</Button>}
              </>
            ) : undefined,
        }}
        banner={
          canEditChild && missingFields.length > 0 ? (
            <MissingFieldsBanner fields={missingFields} onFieldClick={() => setEditDrawerOpen(true)} />
          ) : undefined
        }
        left={
          <>
            {/* CF-2 (09-copii-fisa.md), A3 (Copii.dc.html#2b): Date personale și Părinți sunt
                acum un singur card — data nașterii rămâne și în hero ("Născut ..."), nu e conflict. */}
            <ProfileSection title="Date personale">
              <div className={styles.personalGrid}>
                <span className={styles.personalLabel}>Data nașterii</span>
                <span className={styles.personalValue}>{child.birthDate ? formatDate(child.birthDate) : '—'}</span>
                <span className={styles.personalLabel}>IDNP</span>
                <span className={styles.personalValue}>{child.idnp || '—'}</span>
                <span className={styles.personalLabel}>Adresă</span>
                <span className={styles.personalValue}>{child.address || '—'}</span>
                {child.healthNotes && (
                  <>
                    <span className={styles.personalLabel}>Alergii, sănătate</span>
                    <span className={`${styles.personalValue} ${styles.healthValue}`}>{child.healthNotes}</span>
                  </>
                )}
              </div>

              <div className={styles.divider} />
              <span className={styles.sectionSubtitle}>Părinți</span>
              <ParentRow
                name={child.parent}
                relation={child.parentRelation}
                phone={child.phone}
                onAddPhone={canEditChild ? () => setEditDrawerOpen(true) : undefined}
              />
              {(child.parent2 || child.phone2 || child.parent2Relation) && (
                <ParentRow
                  name={child.parent2 || ''}
                  relation={child.parent2Relation}
                  phone={child.phone2 || ''}
                  onAddPhone={canEditChild ? () => setEditDrawerOpen(true) : undefined}
                />
              )}

              <div className={styles.divider} />
              <div className={styles.sectionSubtitleRow}>
                <span className={styles.sectionSubtitle}>Pot ridica copilul</span>
                {canEditChild && (
                  <Button variant="link" onClick={() => setEditDrawerOpen(true)}>
                    + Adaugă
                  </Button>
                )}
              </div>
              {(child.pickupPersons ?? []).length === 0 ? (
                <p className={styles.notice}>Nimeni adăugat.</p>
              ) : (
                (child.pickupPersons ?? []).map((person: PickupPerson) => (
                  <div key={person.id} className={styles.parentContactRow}>
                    <div className={styles.parentNameCol}>
                      <strong>{person.name}</strong>
                      {(person.relation || person.note) && (
                        <small>{[person.relation, person.note].filter(Boolean).join(' · ')}</small>
                      )}
                    </div>
                    {person.phone && <span>{person.phone}</span>}
                  </div>
                ))
              )}
            </ProfileSection>

            <ProfileSection title="Grupă și educator">
              <div className={styles.groupRow}>
                <span className={`${styles.groupSquare} ${styles[groupSquareTone]}`}>
                  {profileData.groupName.charAt(0).toUpperCase() || '—'}
                </span>
                <div className={styles.groupInfo}>
                  <strong>
                    {profileData.groupName} · {profileData.groupMemberCount}/{profileData.group?.capacity ?? '—'} copii
                  </strong>
                  <small>
                    Educator {profileData.group?.educator || '—'}
                    {profileData.group?.ageMinYears != null || profileData.group?.ageMaxYears != null
                      ? ` · vârste ${profileData.group?.ageMinYears ?? '0'}–${profileData.group?.ageMaxYears ?? '∞'} ani`
                      : ''}
                  </small>
                </div>
                {canEditChild &&
                  (changingGroup ? (
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
                    <Button variant="link" onClick={() => setChangingGroup(true)}>
                      Schimbă
                    </Button>
                  ))}
              </div>
            </ProfileSection>

            <ChildAttendanceSection childId={child.id} month={month} />

            {showHistory && (
              <ProfileSection
                title="Ultimele modificări"
                action={{
                  label: 'Tot istoricul →',
                  onClick: () => onNavigate('audit', { recordType: 'children', recordId: child.id }),
                }}
              >
                <ChildHistorySection historyData={historyData} />
              </ProfileSection>
            )}

            <ProfileSection
              title="Note"
              action={
                canEditChild
                  ? {
                      label: addingNote ? 'Anulează' : '+ Notă',
                      onClick: () => {
                        setAddingNote(!addingNote);
                        setNoteText('');
                      },
                    }
                  : undefined
              }
            >
              {addingNote && (
                <form
                  className={styles.noteForm}
                  autoComplete="off"
                  onSubmit={event => {
                    event.preventDefault();
                    void addNote();
                  }}
                >
                  <TextArea
                    ariaLabel="Notă nouă"
                    rows={2}
                    autoFocus
                    value={noteText}
                    onChange={setNoteText}
                    onKeyDown={event => {
                      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                        event.preventDefault();
                        void addNote();
                      } else if (event.key === 'Escape') {
                        setAddingNote(false);
                        setNoteText('');
                      }
                    }}
                    placeholder="Scrie o notă…"
                  />
                  <Button type="submit" disabled={!noteText.trim()}>
                    Salvează
                  </Button>
                </form>
              )}
              {(() => {
                const visibleNotes = (child.notes ?? []).filter(note => !note.deletedAt);
                if (visibleNotes.length === 0)
                  return (
                    <EmptyState
                      size="compact"
                      variant={EMPTY_STATES['fisa.notes'].variant}
                      title={resolveEmptyStateTitle(EMPTY_STATES['fisa.notes'])}
                    />
                  );
                return visibleNotes.map((note, index) => {
                  if (editingNoteId === note.id) {
                    return (
                      <form
                        key={note.id}
                        className={styles.noteForm}
                        autoComplete="off"
                        onSubmit={event => {
                          event.preventDefault();
                          void saveNoteEdit(note);
                        }}
                      >
                        <TextArea
                          ariaLabel="Editează nota"
                          rows={2}
                          autoFocus
                          value={editingNoteText}
                          onChange={setEditingNoteText}
                          onKeyDown={event => {
                            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                              event.preventDefault();
                              void saveNoteEdit(note);
                            } else if (event.key === 'Escape') {
                              setEditingNoteId(null);
                            }
                          }}
                        />
                        <div className={styles.noteFormActions}>
                          <Button type="button" variant="outline" onClick={() => setEditingNoteId(null)}>
                            Renunță
                          </Button>
                          <Button type="submit" disabled={!editingNoteText.trim()}>
                            Salvează
                          </Button>
                        </div>
                      </form>
                    );
                  }
                  return (
                    <div key={note.id} className={`${styles.noteRow} ${index === 0 ? styles.noteRecent : ''}`}>
                      <p className={styles.noteText}>{note.text}</p>
                      <div className={styles.noteMeta}>
                        <span>
                          {formatDate(note.date)}
                          {note.author ? ` · ${note.author}` : ''}
                          {note.updatedAt ? ' · editată' : ''}
                        </span>
                        {canEditChild && (
                          <RowMenu
                            ariaLabel={`Acțiuni notă ${formatDate(note.date)}`}
                            items={[
                              {
                                label: 'Editează',
                                onClick: () => {
                                  setEditingNoteId(note.id);
                                  setEditingNoteText(note.text);
                                },
                              },
                              { label: 'Șterge', danger: true, onClick: () => void deleteNote(note) },
                            ]}
                          />
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
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
          canViewPayments ? (
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

              <ProfileSection title="Plătitori reținuți">
                <p className={styles.aliasIntro}>
                  Transferurile de la ei se propun direct pentru {child.firstName || child.name} la{' '}
                  <Button variant="link" onClick={() => onNavigate('assign')}>
                    Asociere achitări
                  </Button>
                  .
                </p>
                {profileData.payerAliases.length === 0 ? (
                  <EmptyState
                    variant={EMPTY_STATES['fisa.payers'].variant}
                    size="compact"
                    title={resolveEmptyStateTitle(EMPTY_STATES['fisa.payers'])}
                    action={{ label: EMPTY_STATES['fisa.payers'].actionLabel ?? '', onClick: () => onNavigate('assign') }}
                  />
                ) : (
                  profileData.payerAliases.map(alias => {
                    const usageCount = profileData.payments.filter(
                      payment => normalizePayerAlias(payment.sourceName || '') === normalizePayerAlias(alias.alias),
                    ).length;
                    return (
                      <div key={alias.id} className={styles.aliasRow}>
                        <span className={styles.aliasName}>
                          <strong>{alias.alias}</strong>
                          <small>fără IBAN, doar numele</small>
                        </span>
                        <span className={styles.aliasMeta}>
                          din {formatDate(alias.createdAt.slice(0, 10))}
                          {usageCount > 0 ? ` · ${usageCount} achitări` : ''}
                        </span>
                        {canWritePayments && (
                          <IconButton
                            icon="close"
                            ariaLabel={`Șterge ${alias.alias}`}
                            onClick={() => void deleteAlias(alias)}
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </ProfileSection>
            </>
          ) : (
            // 36e: „Plățile, planul tarifar și notele medicale nu sunt pe acest calculator.”
            <p className={styles.notice}>Plățile, planul tarifar și notele medicale nu sunt pe acest calculator.</p>
          )
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

function ParentRow({
  name,
  relation,
  phone,
  onAddPhone,
}: {
  name: string;
  relation?: string;
  phone: string;
  /** Lipsă pe un profil doar-citire (36e) — rândul rămâne fără acțiune, fără telefon. */
  onAddPhone?: () => void;
}) {
  return (
    <div className={styles.parentContactRow}>
      <div className={styles.parentNameCol}>
        <strong>{name || 'Necunoscut'}</strong>
        {relation && <small>{relation}</small>}
      </div>
      {phone ? (
        <span>{phone}</span>
      ) : (
        onAddPhone && (
          <Button variant="link" onClick={onAddPhone}>
            + adaugă telefon
          </Button>
        )
      )}
    </div>
  );
}

/** 45b: ultimele 3 intrări din istoric pentru copil (fișă + achitările lui), ca mini-Timeline. */
function ChildHistorySection({ historyData }: { historyData: ReturnType<typeof useAuditLog> }) {
  if (historyData.status === 'loading') return <LoadingState />;
  if (historyData.status === 'failed')
    return <p className={styles.notice}>{historyData.failureMessage || 'Istoricul nu a putut fi încărcat.'}</p>;
  if (historyData.status === 'empty' || historyData.rows.length === 0)
    return <p className={styles.notice}>Fără modificări înregistrate încă.</p>;

  const entries: TimelineEntry[] = historyData.rows.slice(0, 3).map(row => ({
    key: String(row.id),
    timestamp: `${row.dayLabel} · ${row.timeLabel}`,
    title: `${row.actionLabel} · ${row.recordLabel}`,
    // 45a: nota medicală nu apare niciodată cu conținut — doar faptul că s-a schimbat.
    description: row.changes
      .map(change =>
        change.field === 'healthNotes'
          ? 'Notă medicală modificată'
          : `${change.field}: ${change.beforeLabel} → ${change.afterLabel}`,
      )
      .join(' · '),
  }));

  return <Timeline entries={entries} />;
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
