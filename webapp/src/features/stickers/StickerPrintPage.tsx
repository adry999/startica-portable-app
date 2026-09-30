import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppSession } from '@shared/api/session';
import { Button, ChipSelect, Field, NumberInput, TextInput } from '@shared/ui';
import { StickerLabel } from './StickerLabel';
import {
  STICKER_DECOR_OPTIONS,
  STICKER_SIZE_OPTIONS,
  STICKER_TEMPLATES,
  STICKER_TEMPLATE_ORDER,
  type StickerDecor,
  type StickerTemplateKey,
} from './sticker-templates';
import type { StickerLabelSize } from './sticker-text-fit';
import styles from './StickerPrintPage.module.css';

interface GroupChildLabel {
  id: string;
  line1: string;
  line2: string;
}

/** Copiii activi ai grupei, sortați ca în restul aplicației — o etichetă „Nume copil" pentru fiecare. */
function activeChildrenOfGroup(
  groupId: string,
  children: { id: string; name: string; groupId: string | null; archived?: boolean }[],
  groups: { id: string; name: string }[],
): GroupChildLabel[] {
  const groupName = groups.find(group => group.id === groupId)?.name ?? '';
  return children
    .filter(child => child.groupId === groupId && !child.archived)
    .sort((a, b) => a.name.localeCompare(b.name, 'ro'))
    .map(child => ({ id: child.id, line1: child.name, line2: groupName ? `Grupa ${groupName}` : '' }));
}

export function StickerPrintPage() {
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('grupa');
  const session = useAppSession();
  const { state, ready } = session.state;

  const [templateKey, setTemplateKey] = useState<StickerTemplateKey>('nume');
  const [size, setSize] = useState<StickerLabelSize>('58x40');
  const [decor, setDecor] = useState<StickerDecor>('cercuri');
  const [line1, setLine1] = useState(STICKER_TEMPLATES.nume.line1);
  const [line2, setLine2] = useState(STICKER_TEMPLATES.nume.line2);
  const [line3, setLine3] = useState(STICKER_TEMPLATES.nume.line3);
  const [copies, setCopies] = useState(1);

  function pickTemplate(key: StickerTemplateKey) {
    const template = STICKER_TEMPLATES[key];
    setTemplateKey(key);
    setLine1(template.line1);
    setLine2(template.line2);
    setLine3(template.line3);
  }

  const groupChildren: GroupChildLabel[] =
    groupId && ready ? activeChildrenOfGroup(groupId, state.children, state.groups) : [];
  const groupName = groupId && ready ? (state.groups.find(group => group.id === groupId)?.name ?? '') : '';
  const isGroupMode = Boolean(groupId);

  // Comanda „Stickere pentru grupă” cere mereu modelul „Nume copil" (25-bon-stickere.md).
  useEffect(() => {
    if (isGroupMode && templateKey !== 'nume') pickTemplate('nume');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGroupMode]);

  const template = STICKER_TEMPLATES[templateKey];
  const badge = template.badge;
  const showIcon = template.showIcon;

  const printLabels: { key: string; line1: string; line2: string; line3: string }[] = isGroupMode
    ? groupChildren.map(child => ({ key: child.id, line1: child.line1, line2: child.line2, line3: '' }))
    : Array.from({ length: Math.max(1, copies) }, (_, index) => ({ key: String(index), line1, line2, line3 }));

  return (
    <div className={styles.page}>
      <style>{'@page { size: 58mm auto; margin: 0; }'}</style>
      <div className={styles.toolbar}>
        <span className={styles.title}>
          {isGroupMode ? `Stickere pentru grupa ${groupName || '—'}` : 'Sticker nou'}
        </span>
        <Button onClick={() => window.print()}>Tipărește</Button>
      </div>

      {!isGroupMode && (
        <div className={styles.editor}>
          <div className={styles.fieldGroup}>
            <span className={styles.fieldGroupLabel}>Model</span>
            <ChipSelect
              ariaLabel="Model"
              value={templateKey}
              onChange={pickTemplate}
              options={STICKER_TEMPLATE_ORDER.map(key => ({ value: key, label: STICKER_TEMPLATES[key].label }))}
            />
          </div>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldGroupLabel}>Mărime etichetă</span>
            <ChipSelect ariaLabel="Mărime etichetă" value={size} onChange={setSize} options={STICKER_SIZE_OPTIONS} />
          </div>

          <Field label="Text mare" htmlFor="sticker-line1">
            <TextInput id="sticker-line1" value={line1} onChange={setLine1} />
          </Field>
          <Field label="Rândul 2" htmlFor="sticker-line2">
            <TextInput id="sticker-line2" value={line2} onChange={setLine2} />
          </Field>
          <Field label="Rândul 3" htmlFor="sticker-line3" optional>
            <TextInput id="sticker-line3" value={line3} onChange={setLine3} />
          </Field>

          <div className={styles.fieldGroup}>
            <span className={styles.fieldGroupLabel}>Decor</span>
            <ChipSelect ariaLabel="Decor" value={decor} onChange={setDecor} options={STICKER_DECOR_OPTIONS} />
          </div>

          <Field label="Copii" htmlFor="sticker-copies">
            <NumberInput
              id="sticker-copies"
              min={1}
              max={200}
              step={1}
              value={String(copies)}
              onChange={value => setCopies(Math.max(1, Number(value) || 1))}
            />
          </Field>
        </div>
      )}

      {isGroupMode && (
        <div className={styles.editor}>
          <div className={styles.fieldGroup}>
            <span className={styles.fieldGroupLabel}>Mărime etichetă</span>
            <ChipSelect ariaLabel="Mărime etichetă" value={size} onChange={setSize} options={STICKER_SIZE_OPTIONS} />
          </div>
          <div className={styles.fieldGroup}>
            <span className={styles.fieldGroupLabel}>Decor</span>
            <ChipSelect ariaLabel="Decor" value={decor} onChange={setDecor} options={STICKER_DECOR_OPTIONS} />
          </div>
          <p className={styles.notice}>{groupChildren.length} copii activi în grupă.</p>
        </div>
      )}

      <div className={styles.previewSection}>
        <span className={styles.previewLabel}>Previzualizare · {size.replace('x', ' × ')}</span>
        <div className={styles.previewFrame}>
          <StickerLabel
            size={size}
            decor={decor}
            line1={isGroupMode ? printLabels[0]?.line1 || 'Nume copil' : line1}
            line2={isGroupMode ? printLabels[0]?.line2 || '' : line2}
            line3={isGroupMode ? '' : line3}
            badge={isGroupMode ? '' : badge}
            showIcon={isGroupMode ? true : showIcon}
          />
        </div>
      </div>

      <div className={styles.printSheet}>
        {printLabels.map(printLabel => (
          <StickerLabel
            key={printLabel.key}
            size={size}
            decor={decor}
            line1={printLabel.line1}
            line2={printLabel.line2}
            line3={printLabel.line3}
            badge={isGroupMode ? '' : badge}
            showIcon={isGroupMode ? true : showIcon}
          />
        ))}
      </div>
    </div>
  );
}
