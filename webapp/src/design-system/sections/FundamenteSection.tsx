import {
  AvatarGroup,
  Breadcrumb,
  DocumentCard,
  PageHeader,
  SegmentCounter,
  SmsPreview,
  Spinner,
  SplitButton,
  Tooltip,
} from '@shared/ui';
import { ComponentShowcase } from '../ComponentShowcase';
import { DemoRow } from '../DemoRow';
import { COLOR_TOKEN_GROUPS, RADIUS_TOKENS, readCssVariable, SHADOW_TOKENS, SPACING_TOKENS } from '../tokens-reference';
import styles from './FundamenteSection.module.css';

/** Culori, tipografie, spațiere, raze și umbre — citite direct din `tokens.css`, nicio culoare nouă. */
export function FundamenteSection() {
  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Fundamente</h2>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>Culori</h3>
        {COLOR_TOKEN_GROUPS.map(group => (
          <div key={group.label} className={styles.colorGroup}>
            <span className={styles.groupLabel}>{group.label}</span>
            <div className={styles.swatchRow}>
              {group.tokens.map(token => (
                <div key={token} className={styles.swatch}>
                  <span className={styles.swatchColor} style={{ background: `var(${token})` }} />
                  <code className={styles.swatchName}>{token}</code>
                  <span className={styles.swatchValue}>{readCssVariable(token) || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>Tipografie</h3>
        <p className={styles.typeSample} style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 30 }}>
          Titlu de pagină — Baloo 2 800, 30px
        </p>
        <p className={styles.typeSample} style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18 }}>
          Titlu de card — Baloo 2 800, 18px
        </p>
        <p className={styles.typeSample} style={{ fontFamily: 'var(--font-body)', fontSize: 14 }}>
          Text — Nunito 400/700, 14px
        </p>
        <p
          className={styles.typeSample}
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 800,
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: 'var(--text-eyebrow-letter-spacing)',
            color: 'var(--subtle)',
          }}
        >
          Eyebrow — Nunito 800, 12px, uppercase
        </p>
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>Spațiere</h3>
        <div className={styles.spacingRow}>
          {SPACING_TOKENS.map(token => (
            <div key={token} className={styles.spacingItem}>
              <span className={styles.spacingBar} style={{ width: `var(${token})` }} />
              <code className={styles.swatchName}>{token}</code>
              <span className={styles.swatchValue}>{readCssVariable(token) || '—'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>Raze</h3>
        <div className={styles.radiusRow}>
          {RADIUS_TOKENS.map(token => (
            <div key={token} className={styles.radiusItem}>
              <span className={styles.radiusBox} style={{ borderRadius: `var(${token})` }} />
              <code className={styles.swatchName}>{token}</code>
              <span className={styles.swatchValue}>{readCssVariable(token) || '—'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>Umbre</h3>
        <div className={styles.shadowRow}>
          {SHADOW_TOKENS.map(token => (
            <div key={token} className={styles.shadowItem}>
              <span className={styles.shadowBox} style={{ boxShadow: `var(${token})` }} />
              <code className={styles.swatchName}>{token}</code>
            </div>
          ))}
        </div>
      </div>

      <ComponentShowcase
        name="Spinner"
        importLine="import { Spinner } from '@shared/ui';"
        reference="DS Incarcare si stari.dc.html §29a/29b — 12/14/16/24/40, currentColor"
      >
        <DemoRow label="size">
          <Spinner size={12} />
          <Spinner size={14} />
          <Spinner size={16} />
          <Spinner size={24} />
          <Spinner size={40} />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="Tooltip"
        importLine="import { Tooltip } from '@shared/ui';"
        reference="DS Componente.dc.html §28g — balon la hover/focus"
      >
        <DemoRow label="control">
          <Tooltip content="Șterge rândul">
            <button type="button">Acțiune</button>
          </Tooltip>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="PageHeader"
        importLine="import { PageHeader } from '@shared/ui';"
        reference="DS Componente.dc.html §28d — antet de ecran"
      >
        <DemoRow label="control">
          <PageHeader
            title="Copii"
            secondaryActions={<button type="button">Exportă</button>}
            primaryAction={<button type="button">+ Copil nou</button>}
          />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="Breadcrumb"
        importLine="import { Breadcrumb } from '@shared/ui';"
        reference="DS Componente.dc.html §28d — fir de ariadnă"
      >
        <DemoRow label="control">
          <Breadcrumb items={[{ label: 'Copii', onClick: () => {} }, { label: 'Ionescu Maria' }]} />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="SplitButton"
        importLine="import { SplitButton } from '@shared/ui';"
        reference="DS Componente 2.dc.html §34c — variantă ținută minte"
      >
        <DemoRow label="control">
          <SplitButton
            selectedValue="pdf"
            onSelectedValueChange={() => {}}
            options={[
              { value: 'pdf', label: 'Exportă PDF', onClick: () => {} },
              { value: 'excel', label: 'Exportă Excel', onClick: () => {} },
            ]}
          />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="SegmentCounter"
        importLine="import { SegmentCounter } from '@shared/ui';"
        reference="COMPONENTE.md §0g — contor de caractere/segmente SMS"
      >
        <DemoRow label="control">
          <SegmentCounter text="Buna ziua! Va reamintim ca maine este ziua de achitare a taxei lunare." />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="SmsPreview"
        importLine="import { SmsPreview } from '@shared/ui';"
        reference="COMPONENTE.md §0g — previzualizare SMS"
      >
        <DemoRow label="control">
          <SmsPreview
            senderName="Grădinița Pitici"
            message="Bună ziua! Vă reamintim că mâine este ziua de achitare a taxei lunare."
          />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="DocumentCard"
        importLine="import { DocumentCard } from '@shared/ui';"
        reference="COMPONENTE.md §0i — document încărcat"
      >
        <DemoRow label="control">
          <DocumentCard fileName="Certificat_medical.pdf" meta="PDF · 240 KB" onOpen={() => {}} onRemove={() => {}} />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="AvatarGroup"
        importLine="import { AvatarGroup } from '@shared/ui';"
        reference="COMPONENTE.md §0e — grup de avataruri suprapuse"
      >
        <DemoRow label="control">
          <AvatarGroup
            items={[
              { name: 'Ionescu Maria' },
              { name: 'Popescu Andrei' },
              { name: 'Rusu Ana' },
              { name: 'Marin Elena' },
              { name: 'Coceva Alisa' },
            ]}
            maxVisible={3}
          />
        </DemoRow>
      </ComponentShowcase>
    </div>
  );
}
