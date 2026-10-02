import type { ReactNode } from 'react';
import { Card, type CardTone } from './Card';
import { PersonCell } from './PersonCell';
import type { PillTone } from './FilterPills';
import styles from './ProfileLayout.module.css';

const CARD_TONE: Record<PillTone, CardTone> = {
  orange: 'orange',
  mint: 'mint',
  yellow: 'yellow',
  pink: 'pink',
  teal: 'teal',
  blue: 'blue',
  purple: 'purple',
  coral: 'coral',
  neutral: 'white',
};

export interface ProfileLayoutBadge {
  label: string;
  tone: PillTone;
}

export interface ProfileLayoutHeader {
  name: string;
  tone: PillTone;
  meta: ReactNode;
  badges?: ProfileLayoutBadge[];
  actions?: ReactNode;
}

export interface ProfileLayoutProps {
  back: { label: string; onClick: () => void };
  header: ProfileLayoutHeader;
  /** Bandă opțională sub antet (41a: `MissingFieldsBanner` pe fișa copilului) — generică,
   * orice fișă o poate folosi, nu doar Copii. */
  banner?: ReactNode;
  left: ReactNode;
  /** Maximum 3, pe un rând. */
  stats?: ReactNode[];
  right: ReactNode;
}

/** Fișa unei persoane (copil sau angajat) — bandă + grilă stânga/dreapta, comună Copii și Personal. */
export function ProfileLayout({ back, header, banner, left, stats, right }: ProfileLayoutProps) {
  return (
    <>
      <p className={styles.breadcrumb}>
        <button type="button" onClick={back.onClick}>
          {back.label}
        </button>{' '}
        / {header.name}
      </p>

      <Card tone={CARD_TONE[header.tone]} decorative className={styles.header}>
        <PersonCell
          size="lg"
          name={header.name}
          tone={header.tone}
          sub={
            <>
              {header.meta}
              {header.badges?.map(badge => (
                <span key={badge.label} className={`${styles.badge} ${styles[`badge_${badge.tone}`]}`}>
                  {badge.label}
                </span>
              ))}
            </>
          }
        />
        {header.actions && <div className={styles.actions}>{header.actions}</div>}
      </Card>

      {banner && <div className={styles.banner}>{banner}</div>}

      <div className={styles.grid}>
        <div className={styles.left}>{left}</div>
        <div className={styles.right}>
          {stats && stats.length > 0 && <div className={styles.stats}>{stats}</div>}
          {right}
        </div>
      </div>
    </>
  );
}

export interface ProfileSectionProps {
  title: string;
  tone?: CardTone;
  action?: { label: string; onClick: () => void };
  children: ReactNode;
}

/** Card cu titlu (Baloo 18) și, opțional, un link în dreapta titlului. */
export function ProfileSection({ title, tone, action, children }: ProfileSectionProps) {
  return (
    <Card tone={tone} className={styles.section}>
      {action ? (
        <div className={styles.sectionHead}>
          <p className={styles.sectionTitle}>{title}</p>
          <button type="button" className={styles.sectionLink} onClick={action.onClick}>
            {action.label}
          </button>
        </div>
      ) : (
        <p className={styles.sectionTitle}>{title}</p>
      )}
      {children}
    </Card>
  );
}

export interface StatCardProps {
  label: string;
  value: ReactNode;
  tone?: CardTone;
  sub?: ReactNode;
  link?: { label: string; onClick: () => void };
}

/** Mini-card de statistică din dreapta unei fișe (Sold, Taxă lunară, Concediu rămas…). */
export function StatCard({ label, value, tone, sub, link }: StatCardProps) {
  return (
    <Card tone={tone} className={styles.statCard}>
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
      {link && (
        <button type="button" className={styles.statLink} onClick={link.onClick}>
          {link.label}
        </button>
      )}
    </Card>
  );
}

/** Fișa cerută nu a fost găsită (id invalid/șters). */
export function ProfileNotFound({ back }: { back: { label: string; onClick: () => void } }) {
  return (
    <>
      <button type="button" className={styles.backLink} onClick={back.onClick}>
        ← {back.label}
      </button>
      <p className={styles.notice}>Fișa nu a putut fi găsită.</p>
    </>
  );
}
