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
import { useChildProfile } from './useChildProfile';
import { ChildAttendanceSection } from './ChildAttendanceSection';
import { ChildFormDrawer } from './ChildFormDrawer';
import { buildChildRecord, type ChildFormValues } from './child-form';
import type { Payment, PaymentAllocation } from '@contracts/record-types.mjs';
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
            { label: profileData.groupName, tone: 'orange' },
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

            <ProfileSection
              title="Note"
              tone={child.notes ? 'yellow' : 'white'}
              action={{ label: '+ Notă', onClick: () => setEditDrawerOpen(true) }}
            >
              <p>{child.notes || 'Nicio notă încă.'}</p>
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
            sub={child.contractDate ? formatDate(child.contractDate) : '—'}
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

            <ChildAttendanceSection childId={child.id} month={month} />
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
