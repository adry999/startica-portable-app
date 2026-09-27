import { useState } from 'react';
import {
  BnmRateLink,
  ConfirmDeleteDialog,
  Drawer,
  EmptyState,
  LoadingState,
  Skeleton,
  SmsConfirmDialog,
  useToast,
} from '@shared/ui';
import { ComponentShowcase } from '../ComponentShowcase';
import { DemoRow } from '../DemoRow';
import { createDemoSmsResult, DEMO_DAY, DEMO_SMS_RECIPIENTS } from '../fixtures';
import styles from './FeedbackSection.module.css';

/** Stări de sistem: confirmări, panouri, încărcare și dialogul de SMS. */
export function FeedbackSection() {
  const toast = useToast();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [smsSingleOpen, setSmsSingleOpen] = useState(false);
  const [smsBulkOpen, setSmsBulkOpen] = useState(false);

  return (
    <div className={styles.section}>
      <h2 className={styles.heading}>Feedback</h2>

      <ComponentShowcase
        name="ToastProvider"
        importLine="import { ToastProvider, useToast } from '@shared/ui';"
        reference="13-formulare.md (toast „Anulează” la arhivare) · vizual în Formulare.dc.html#15d–#15f"
      >
        <DemoRow label="useToast()">
          <button
            type="button"
            onClick={() => toast.show({ message: '3 achitări arhivate', actionLabel: 'Anulează', onAction: () => {} })}
            data-export="useToast"
          >
            Arată un toast
          </button>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="LoadingState"
        importLine="import { LoadingState } from '@shared/ui';"
        reference="21-incarcare.md §21b (între pagini) · vizual în Incarcare.dc.html#21b"
      >
        <DemoRow label="control">
          <div className={styles.frame} data-export="useDelayedLoading">
            <LoadingState />
          </div>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="Skeleton"
        importLine="import { Skeleton } from '@shared/ui';"
        reference="21-incarcare.md §21b (forma ecranului țintă) · vizual în Incarcare.dc.html#21b"
      >
        <DemoRow label="control">
          <div className={styles.frame}>
            <Skeleton />
          </div>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="ConfirmDeleteDialog"
        importLine="import { ConfirmDeleteDialog } from '@shared/ui';"
        reference="13-formulare.md §Ștergere definitivă · vizual în Formulare.dc.html#15d"
      >
        <DemoRow label="control">
          <button type="button" onClick={() => setConfirmDeleteOpen(true)}>
            Deschide dialogul
          </button>
          <ConfirmDeleteDialog
            open={confirmDeleteOpen}
            title="Șterge copilul definitiv?"
            description="Datele lui nu mai pot fi recuperate, inclusiv achitările și vizitele înregistrate."
            onConfirm={() => setConfirmDeleteOpen(false)}
            onCancel={() => setConfirmDeleteOpen(false)}
          />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="Drawer"
        importLine="import { Drawer } from '@shared/ui';"
        reference="13-formulare.md (panou lateral, comun 15a/15b) · vizual în Formulare.dc.html#15a"
      >
        <DemoRow label="control">
          <button type="button" onClick={() => setDrawerOpen(true)}>
            Deschide panoul
          </button>
          <Drawer
            open={drawerOpen}
            title="Achitare nouă (exemplu)"
            onClose={() => setDrawerOpen(false)}
            footer={
              <button type="button" onClick={() => setDrawerOpen(false)}>
                Salvează
              </button>
            }
          >
            <p>Conținutul formularului — doar demonstrativ, fără date reale.</p>
          </Drawer>
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="SmsConfirmDialog"
        importLine="import { SmsConfirmDialog } from '@shared/ui';"
        reference="14-sms.md · 07-situatia.md §7c (unic) / §7d–#7e (lot) · vizual în Situatia.dc.html#7c–#7e"
      >
        <DemoRow label="single">
          <button type="button" onClick={() => setSmsSingleOpen(true)}>
            Trimite SMS unui părinte
          </button>
          <SmsConfirmDialog
            open={smsSingleOpen}
            mode="single"
            recipients={DEMO_SMS_RECIPIENTS.slice(0, 1)}
            unitCostLei={0.3}
            balanceLei={120}
            onSend={async ids => createDemoSmsResult(ids)}
            onClose={() => setSmsSingleOpen(false)}
            onSent={() => {}}
          />
        </DemoRow>
        <DemoRow label="bulk">
          <button type="button" onClick={() => setSmsBulkOpen(true)}>
            Trimite SMS mai multor părinți
          </button>
          <SmsConfirmDialog
            open={smsBulkOpen}
            mode="bulk"
            recipients={DEMO_SMS_RECIPIENTS}
            unitCostLei={0.3}
            balanceLei={120}
            onSend={async ids => createDemoSmsResult(ids)}
            onRetry={async ids => createDemoSmsResult(ids)}
            onClose={() => setSmsBulkOpen(false)}
            onSent={() => {}}
          />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="EmptyState"
        importLine="import { EmptyState } from '@shared/ui';"
        reference="13-formulare.md §15e (liste goale) · vizual în Formulare.dc.html#15e"
      >
        <DemoRow label="no-results">
          <EmptyState
            title="Niciun rezultat pentru „Popescu”"
            activeFilters={['Arhivați', 'Grupa Mars']}
            onClearFilters={() => {}}
          />
        </DemoRow>
        <DemoRow label="resolved">
          <EmptyState
            variant="resolved"
            title="Totul e rezolvat"
            description="Nicio achitare fără copil asociat. Lista se completează singură la următorul import."
          />
        </DemoRow>
        <DemoRow label="first-step">
          <EmptyState
            variant="first-step"
            title="Nicio cheltuială în septembrie"
            description="Adaugă prima cheltuială ca să vezi diferența pe Dashboard."
            action={{ label: '+ Cheltuială nouă', onClick: () => {} }}
          />
        </DemoRow>
      </ComponentShowcase>

      <ComponentShowcase
        name="BnmRateLink"
        importLine="import { BnmRateLink } from '@shared/ui';"
        reference="16-planuri-eur.md §12b (badge „BNM dd.mm”) · vizual în Planuri si curs.dc.html#12b"
      >
        <DemoRow label="control">
          <span>
            Curs BNM din {DEMO_DAY} <BnmRateLink date={DEMO_DAY} />
          </span>
        </DemoRow>
      </ComponentShowcase>
    </div>
  );
}
