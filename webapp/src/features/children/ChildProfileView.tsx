import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Card, DataTable, useToast, type DataTableColumn } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { formatDate } from '#shared/format/date-format.mjs';
import { formatMoney } from '#shared/format/money-format.mjs';
import { allocations } from '#shared/domain/payment-allocations.mjs';
import { useChildProfile } from './useChildProfile';
import { ChildFormDrawer } from './ChildFormDrawer';
import { buildChildRecord, type ChildFormValues } from './child-form';
import { initials } from './ChildrenPage';
import type { Payment, PaymentAllocation } from '@contracts/record-types.mjs';
import type { ViewKey } from '@shared/view-key';
import styles from './ChildrenPage.module.css';

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
  const toast = useToast();
  const navigate = useNavigate();
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);

  if (profileData.status === 'loading') return <p className={styles.notice}>Se încarcă datele…</p>;
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
  }

  async function submitChildEdit(values: ChildFormValues) {
    try {
      const record = buildChildRecord(child, child.id, values);
      await session.mutate('/api/record', { type: 'children', mode: 'update', record });
      setEditDrawerOpen(false);
      toast.show({ message: 'Fișă actualizată.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  return (
    <>
      <p className={styles.breadcrumb}>
        <button type="button" onClick={onBack}>
          Copii
        </button>{' '}
        / {child.name}
      </p>

      <Card tone="orange" decorative className={styles.profileHeader}>
        <span className={styles.profileAvatar}>{initials(child.name)}</span>
        <div className={styles.profileHeadInfo}>
          <h2 className={styles.profileName}>{child.name}</h2>
          <p className={styles.profileMeta}>
            {child.birthDate ? formatDate(child.birthDate) : 'dată necunoscută'} · {profileData.age} · Contract{' '}
            {profileData.contractLabel}
            <span className={styles.profileBadgeMint}>{child.status}</span>
            <span className={styles.profileBadgeOrange}>{profileData.groupName}</span>
          </p>
        </div>
        <div className={styles.profileActions}>
          <button type="button" className={styles.btnWhite} onClick={() => setEditDrawerOpen(true)}>
            Editează fișa
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => navigate(`/achitari/nou?copil=${child.id}`)}
          >
            + Plată
          </button>
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
              <span className={styles.groupSquare}>{profileData.groupName.charAt(0).toUpperCase() || '—'}</span>
              <select
                className={styles.select}
                value={child.groupId ?? ''}
                onChange={event => void changeGroup(event.target.value)}
                aria-label="Schimbă grupa"
              >
                <option value="">Nealocată</option>
                {profileData.groups.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          {child.notes && (
            <Card tone="yellow" className={styles.profileSection}>
              <p className={styles.sectionTitle}>Note</p>
              <p>{child.notes}</p>
            </Card>
          )}
        </div>

        <div className={styles.profileRight}>
          <div className={styles.miniCards}>
            <Card tone="mint" className={styles.miniCard}>
              <span>Sold</span>
              <strong>{formatMoney(childObligation?.rest ?? null)}</strong>
            </Card>
            <Card tone="yellow" className={styles.miniCard}>
              <span>Taxă lunară</span>
              <strong>{formatMoney(child.fee)}</strong>
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
            <PaymentHistoryTable payments={profileData.payments} />
          </Card>
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

function PaymentHistoryTable({ payments }: { payments: Payment[] }) {
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
      header: 'Sumă',
      align: 'end',
      render: payment => formatMoney(payment.amount),
      sortValue: payment => payment.amount,
    },
    {
      key: 'status',
      header: '',
      render: payment => (
        <Badge tone={payment.archived ? 'neutral' : 'mint'}>{payment.archived ? 'Arhivată' : 'Achitat'}</Badge>
      ),
    },
  ];

  return <DataTable columns={columns} rows={payments} rowKey={payment => payment.id} pageSize={6} />;
}
