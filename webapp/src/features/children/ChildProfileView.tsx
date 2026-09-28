import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  BnmRateLink,
  Button,
  Card,
  DataTable,
  LoadingState,
  RowMenu,
  SearchSelect,
  groupTone,
  useToast,
  type CardTone,
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
import { initials } from '@shared/format/initials';
import type { Payment, PaymentAllocation } from '@contracts/record-types.mjs';
import type { ViewKey } from '@shared/view-key';
import styles from './ChildrenPage.module.css';

const GROUP_SQUARE_TONE_CLASS: Record<PillTone, string> = {
  orange: 'groupSquareOrange',
  mint: 'groupSquareMint',
  yellow: 'groupSquareYellow',
  pink: 'groupSquarePink',
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
    return (
      <>
        <button type="button" className={styles.backLink} onClick={onBack}>
          ← Copii
        </button>
        <p className={styles.notice}>Fișa nu a putut fi găsită.</p>
      </>
    );
  }

  const { child, obligation: childObligation } = profileData;
  const isEurChild = childObligation?.currency === 'EUR';
  const todaysRate = latestKnownRate(rates);
  const heroTone = groupTone(child.groupId, profileData.groups);
  const heroCardTone: CardTone = heroTone === 'neutral' ? 'white' : heroTone;
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
      <p className={styles.breadcrumb}>
        <button type="button" onClick={onBack}>
          Copii
        </button>{' '}
        / {child.name}
      </p>

      <Card tone={heroCardTone} decorative className={styles.profileHeader}>
        <span className={styles.profileAvatar}>{initials(child.name)}</span>
        <div className={styles.profileHeadInfo}>
          <h2 className={styles.profileName}>{child.name}</h2>
          <p className={styles.profileMeta}>
            Născut {child.birthDate ? formatDate(child.birthDate) : 'dată necunoscută'} · {profileData.age} · Contract{' '}
            {profileData.contractLabel}
            <span className={styles.profileBadgeMint}>{child.status}</span>
            <span className={styles.profileBadgeOrange}>{profileData.groupName}</span>
          </p>
        </div>
        <div className={styles.profileActions}>
          <Button variant="white" onClick={() => setEditDrawerOpen(true)}>
            Editează fișa
          </Button>
          <Button onClick={() => navigate(`/achitari/nou?copil=${child.id}`)}>+ Plată</Button>
        </div>
      </Card>

      <div className={styles.profileGrid}>
        <div className={styles.profileLeft}>
          <Card className={styles.profileSection}>
            <p className={styles.sectionTitle}>Părinți</p>
            <ParentRow name={child.parent} phone={child.phone} onAddPhone={() => setEditDrawerOpen(true)} />
            {(child.parent2 || child.phone2) && (
              <ParentRow
                name={child.parent2 || ''}
                phone={child.phone2 || ''}
                onAddPhone={() => setEditDrawerOpen(true)}
              />
            )}
          </Card>

          <Card className={styles.profileSection}>
            <p className={styles.sectionTitle}>Grupă și educator</p>
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
          </Card>

          <Card tone={child.notes ? 'yellow' : 'white'} className={styles.profileSection}>
            <div className={styles.sectionHead}>
              <p className={styles.sectionTitle}>Note</p>
              <button type="button" className={styles.sectionLink} onClick={() => setEditDrawerOpen(true)}>
                + Notă
              </button>
            </div>
            <p>{child.notes || 'Nicio notă încă.'}</p>
          </Card>
        </div>

        <div className={styles.profileRight}>
          <div className={styles.miniCards}>
            <Card tone="mint" className={styles.miniCard}>
              <span>Sold</span>
              <strong>{formatMoney(childObligation?.rest ?? null, childObligation?.currency)}</strong>
              <small>
                {childObligation?.rest
                  ? `${formatMoney(childObligation.rest, childObligation.currency)} datorie${
                      isEurChild && todaysRate
                        ? ` · ≈ ${formatMoney(convertAmount(childObligation.rest, 'EUR', 'MDL', todaysRate), 'MDL')} azi`
                        : ''
                    }`
                  : 'La zi'}
              </small>
            </Card>
            <Card tone="yellow" className={styles.miniCard}>
              <span>Taxă lunară</span>
              <strong>
                {formatMoney(profileData.feeEntry?.amount ?? child.fee, profileData.feeEntry?.currency ?? 'MDL')}
              </strong>
              <small>{childObligation ? `scadență ziua ${Number(childObligation.due.slice(-2))}` : '—'}</small>
            </Card>
            <Card className={styles.miniCard}>
              <span>Contract</span>
              <strong>{profileData.contractLabel}</strong>
              <small>{child.contractDate ? formatDate(child.contractDate) : '—'}</small>
            </Card>
          </div>

          <Card className={styles.profileSection}>
            <div className={styles.sectionHead}>
              <p className={styles.sectionTitle}>Istoric plăți</p>
              <button
                type="button"
                className={styles.sectionLink}
                onClick={() => onNavigate('payments', { copil: child.id })}
              >
                Toate achitările →
              </button>
            </div>
            <PaymentHistoryTable
              payments={profileData.payments}
              showEurColumns={isEurChild}
              onPrint={paymentId => navigate(`/achitari/${paymentId}/confirmare`)}
            />
          </Card>

          <ChildAttendanceSection childId={child.id} month={month} />
        </div>
      </div>

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
      render: payment => (
        <RowMenu items={[{ label: 'Tipărește confirmarea', onClick: () => onPrint(payment.id) }]} />
      ),
    },
  ];

  return <DataTable columns={columns} rows={payments} rowKey={payment => payment.id} pageSize={6} />;
}
