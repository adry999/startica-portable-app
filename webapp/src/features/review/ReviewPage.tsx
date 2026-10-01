import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  EMPTY_STATES,
  EmptyState,
  Kbd,
  LoadingState,
  resolveEmptyStateText,
  resolveEmptyStateTitle,
  ScrollArea,
  SearchInput,
  SegmentedControl,
  SelectableRow,
  useToast,
  useTopbarActions,
} from '@shared/ui';
import { initials } from '@shared/format/initials';
import { capitalize } from '#shared/format/date-format.mjs';
import { useReview, type ReviewRowView, type ReviewTypeCounts, type ReviewTypeFilter } from './useReview';
import type { ViewKey } from '@shared/view-key';
import styles from './ReviewPage.module.css';

const TYPE_LABEL: Record<ReviewRowView['type'], string> = {
  children: 'Fișă',
  payments: 'Achitare',
};

function typeOptions(counts: ReviewTypeCounts) {
  return [
    { value: 'all' as const, label: `Toate · ${counts.all}` },
    { value: 'children' as const, label: `Fișe · ${counts.children}` },
    { value: 'payments' as const, label: `Achitări · ${counts.payments}` },
  ];
}

function rowKey(row: ReviewRowView): string {
  return `${row.type} ${row.id}`;
}

export interface ReviewPageProps {
  onNavigate: (view: ViewKey) => void;
}

/** `onNavigate` rămâne în semnătură pentru App.tsx (ruta de sub `/de-verificat`); ecranul navighează
 * direct spre fișa/achitarea în cauză cu `useNavigate` din react-router (R-5), nu spre lista generică. */
export function ReviewPage({ onNavigate: _onNavigate }: ReviewPageProps) {
  const reviewData = useReview();
  const toast = useToast();
  const navigate = useNavigate();
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const rows = reviewData.rows;
  const foundIndex = rows.findIndex(row => rowKey(row) === activeKey);
  const activeIndex = foundIndex === -1 ? 0 : foundIndex;
  const active = rows[activeIndex] ?? null;

  function skip() {
    if (rows.length === 0) return;
    const next = (activeIndex + 1) % rows.length;
    setActiveKey(rowKey(rows[next]));
  }

  useTopbarActions(
    <SegmentedControl<ReviewTypeFilter>
      ariaLabel="Arată"
      value={reviewData.typeFilter}
      onChange={reviewData.setTypeFilter}
      options={typeOptions(reviewData.counts)}
    />,
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 's') return;
      const target = event.target as HTMLElement | null;
      // Nu fură tasta "s" cât timp utilizatorul scrie în căutare sau alt câmp.
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      skip();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, activeIndex]);

  if (reviewData.status === 'loading') return <LoadingState />;
  if (reviewData.status === 'failed')
    return <p className={styles.notice}>{reviewData.failureMessage || 'Datele nu au putut fi încărcate.'}</p>;

  function openRecord(row: ReviewRowView) {
    navigate(row.type === 'payments' ? `/achitari/${row.id}` : `/copii/${row.id}`);
  }

  async function confirm(paymentId: string) {
    try {
      await reviewData.confirmReview(paymentId);
      toast.show({ message: 'Marcat ca verificat.' });
      skip();
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        variant={EMPTY_STATES['derezolvat.done'].variant}
        title={resolveEmptyStateTitle(EMPTY_STATES['derezolvat.done'])}
        description={resolveEmptyStateText(EMPTY_STATES['derezolvat.done'])}
      />
    );
  }

  return (
    <div className={styles.grid}>
      <Card className={styles.queueCard}>
        <div className={styles.queueToolbar}>
          <SearchInput
            className={styles.search}
            placeholder="Nume, contract, sursă sau observație"
            value={reviewData.search}
            onChange={reviewData.setSearch}
            ariaLabel="Caută"
          />
        </div>
        <ScrollArea className={styles.queueList}>
          {rows.map(row => (
            <SelectableRow
              key={rowKey(row)}
              className={row === active ? `${styles.queueRow} ${styles.queueRowActive}` : styles.queueRow}
              aria-current={row === active}
              onClick={() => setActiveKey(rowKey(row))}
            >
              <span className={`${styles.dot} ${styles[`dot${capitalize(row.severity)}`]}`} aria-hidden="true" />
              <span className={styles.queueText}>
                <strong>{row.name}</strong>
                <small>{row.reasons[0]}</small>
              </span>
              <span className={styles.queueType}>{TYPE_LABEL[row.type]}</span>
            </SelectableRow>
          ))}
        </ScrollArea>
      </Card>

      {active && (
        <div className={styles.detail}>
          <div className={styles.progressRow}>
            <strong>
              {activeIndex + 1} din {rows.length}
            </strong>
            <div className={styles.progressTrack}>
              <span style={{ width: `${((activeIndex + 1) / rows.length) * 100}%` }} />
            </div>
            <span className={styles.skipHint}>
              Sari peste <Kbd>S</Kbd>
            </span>
          </div>

          <Card className={styles.caseCard}>
            <div className={styles.identity}>
              <span className={styles.identityAvatar}>{initials(active.name)}</span>
              <div className={styles.identityText}>
                <strong>{active.name}</strong>
                <span>{active.subtitle}</span>
              </div>
              <Button variant="link" className={styles.openLink} onClick={() => openRecord(active)}>
                {active.type === 'payments' ? 'Deschide achitarea →' : 'Deschide fișa →'}
              </Button>
            </div>

            <div className={styles.problemBox}>
              <strong>{reviewData.labels[active.categories[0]] ?? 'Problemă'}</strong>
              <span>{active.reasons.join(' · ')}</span>
              {active.confirmed && <Badge tone="mint">Verificat</Badge>}
            </div>

            <div className={styles.actionsRow}>
              {active.canConfirm ? (
                <Button onClick={() => void confirm(active.id)}>Confirmă asocierea</Button>
              ) : (
                <Button onClick={() => openRecord(active)}>
                  {active.type === 'payments' ? 'Corectează achitarea' : 'Corectează fișa'}
                </Button>
              )}
              {active.type === 'payments' && !active.canConfirm && !active.confirmed && (
                <Button variant="outline" onClick={() => void confirm(active.id)}>
                  Nu e o problemă · marchează verificat
                </Button>
              )}
              <Button variant="link" className={styles.skipButton} onClick={skip}>
                Sari peste
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
