import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Badge,
  Button,
  Card,
  Drawer,
  EmptyState,
  Field,
  LoadingState,
  SegmentedControl,
  Select,
  TextInput,
  useToast,
  type BadgeTone,
  type CardTone,
} from '@shared/ui';
import { EMPTY_STATES, resolveEmptyStateTitle } from '@shared/ui/empty-states';
import { requestJson, useAppSession } from '@shared/api/session';
import { usePersistedState } from '@shared/state/usePersistedState';
import { formatDateTime } from '#shared/format/date-format.mjs';
import { formatFileSize } from '#shared/format/file-size-format.mjs';
import { useBackup, type BackupHealthView, type HealthTone } from './useBackup';
import { useRestore } from './useRestore';
import { useExcelTransfer } from './useExcelTransfer';
import { ExcelImportDialog } from './ExcelImportDialog';
import { BackupPreviewTable, type BackupPreviewDatabaseRow } from './BackupPreviewTable';
import { RestoreDoneDialog } from './RestoreDoneDialog';
import { writeRestoreDoneNote } from './restore-reload-note';
import { ExchangeRateSettings } from './ExchangeRateSettings';
import { KindergartenSettings } from './KindergartenSettings';
import { BranchesSettings } from './BranchesSettings';
import { SyncSettings } from './SyncSettings';
import { PoolSettings } from './PoolSettings';
import { ServicesSettings } from './ServicesSettings';
import styles from './BackupPage.module.css';
import { toUserError } from '@shared/api/to-user-error';

const STATUS_TONE: Record<HealthTone, BadgeTone> = { ok: 'mint', warning: 'yellow', error: 'pink' };

type ViewMode = 'backup' | 'curs' | 'kindergarten' | 'branches' | 'sync' | 'pool' | 'services';

// O zi în ms — același prag ca useBackup/useRestore pentru „vechi”.
const STALE_AFTER_MS = 86400000;

interface BackupListEntry {
  name: string;
  modified: string;
  bytes?: number;
}

/** Lista propriu-zisă de copii (dată, mărime) pentru cardul „Copii de siguranță” — separată de
 * useRestore, care încarcă aceeași listă doar când se deschide fereastra de restaurare. */
function useBackupsList(active: boolean) {
  const [entries, setEntries] = useState<BackupListEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoading(true);
    requestJson('/api/backups')
      .then(data => {
        if (!cancelled) setEntries(data as BackupListEntry[]);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  return { entries, loading };
}

interface BackupPreviewResponse {
  archive: boolean;
  createdAt?: string;
  appVersion?: string;
  children?: number;
  payments?: number;
  expenses?: number;
  databases?: { id: string; name: string; kind: 'branch' | 'common'; counts: Record<string, number> }[];
}

/** §6 (PROMPT-10, 10c): „Vezi conținutul” pe un rând din „Copii de siguranță” — același
 * `/api/backup-preview` ca la Restaurare/prima pornire, dar aici pentru simplă inspecție, nu
 * pentru restaurare. Un backup vechi (per-filială, fără manifest) nu are `databases` — arătăm
 * un singur rând, cu numărătoarea plată a acelei filiale (ca pe ecranul de Restaurare). */
function useBackupPreviewDrawer() {
  const [target, setTarget] = useState<BackupListEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{
    createdAt?: string;
    appVersion?: string;
    databases: BackupPreviewDatabaseRow[];
  } | null>(null);

  function close() {
    setTarget(null);
  }

  function open(entry: BackupListEntry) {
    setTarget(entry);
    setPreview(null);
    setError('');
    setLoading(true);
    requestJson(`/api/backup-preview?name=${encodeURIComponent(entry.name)}`)
      .then(response => {
        const data = response as BackupPreviewResponse;
        const databases: BackupPreviewDatabaseRow[] = data.archive
          ? (data.databases ?? []).map(row => ({
              id: row.id,
              name: row.name,
              kind: row.kind,
              children: row.counts.children ?? 0,
              payments: row.counts.payments ?? 0,
              expenses: row.counts.expenses ?? 0,
            }))
          : [
              {
                id: entry.name,
                name: entry.name,
                kind: 'branch',
                children: data.children ?? 0,
                payments: data.payments ?? 0,
                expenses: data.expenses ?? 0,
              },
            ];
        setPreview({ createdAt: data.createdAt, appVersion: data.appVersion, databases });
      })
      .catch((err: Error) => setError(toUserError(err)))
      .finally(() => setLoading(false));
  }

  return { target, loading, error, preview, open, close };
}

function isStale(timestamp: string): boolean {
  return !timestamp || Date.now() - new Date(timestamp).getTime() > STALE_AFTER_MS;
}

interface StatusCardView {
  tone: CardTone;
  warning: boolean;
  label: string;
  headline: string;
  subtitle: string;
}

/** Cardurile ①②③ de sus (10c) — un ton per card, nu doar un singur status agregat. */
function localBackupCard(health: BackupHealthView): StatusCardView {
  if (health.localError)
    return { tone: 'pink', warning: true, label: '② Backup local', headline: 'Eșuat', subtitle: health.localError };
  if (isStale(health.lastLocal))
    return {
      tone: 'yellow',
      warning: true,
      label: '② Backup local',
      headline: 'Vechi sau lipsă',
      subtitle: `Ultimul: ${formatDateTime(health.lastLocal)}`,
    };
  return {
    tone: 'mint',
    warning: false,
    label: '② Backup local',
    headline: `OK · ${formatDateTime(health.lastLocal)}`,
    subtitle: `${health.permanentBackups.count} copii păstrate`,
  };
}

function externalBackupCard(health: BackupHealthView): StatusCardView {
  if (!health.externalDir)
    return {
      tone: 'yellow',
      warning: true,
      label: '③ Copie externă',
      headline: 'Neconfigurată',
      subtitle: 'Dacă se strică discul, datele se pierd.',
    };
  if (health.externalError)
    return {
      tone: 'pink',
      warning: true,
      label: '③ Copie externă',
      headline: 'Eroare',
      subtitle: health.externalError,
    };
  if (isStale(health.lastExternal))
    return {
      tone: 'yellow',
      warning: true,
      label: '③ Copie externă',
      headline: 'Verifică sincronizarea',
      subtitle: `Ultima: ${formatDateTime(health.lastExternal)}`,
    };
  return {
    tone: 'mint',
    warning: false,
    label: '③ Copie externă',
    headline: `OK · ${formatDateTime(health.lastExternal)}`,
    subtitle: `${health.externalBackups.count} copii păstrate`,
  };
}

export function BackupPage() {
  const session = useAppSession();
  const backupData = useBackup();
  const restore = useRestore(backupData.health?.externalDir ?? '');
  const excel = useExcelTransfer();
  const toast = useToast();
  // Topbar.tsx scrie 'curs' în localStorage pentru pastila de curs din Dashboard; 'rates' e
  // cheia veche (pre-redenumire filă), citită tot ca fila de curs, ca link-ul salvat să rămână valabil.
  const [storedViewMode, setStoredViewMode] = usePersistedState<ViewMode | 'rates'>('view.backup', 'backup');
  const viewMode: ViewMode = storedViewMode === 'rates' ? 'curs' : storedViewMode;
  const setViewMode = (next: ViewMode) => setStoredViewMode(next);
  const backupsList = useBackupsList(backupData.ready && viewMode === 'backup');
  const backupPreview = useBackupPreviewDrawer();
  const externalDirInputRef = useRef<HTMLInputElement>(null);

  function focusExternalDirInput() {
    externalDirInputRef.current?.focus();
    externalDirInputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  async function exportExcel() {
    try {
      await excel.exportAll();
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    try {
      await backupData.saveSettings();
      toast.show({
        message: backupData.health?.externalDir
          ? 'Copia în folderul extern a fost verificată. Confirmă separat sincronizarea în Google Drive.'
          : 'Backup local configurat.',
      });
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  async function backupNow() {
    try {
      await backupData.backupNow();
      toast.show({ message: 'Backup local verificat creat.' });
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  async function downloadDiagnostic() {
    try {
      await backupData.downloadDiagnostic();
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  async function commitRestore() {
    try {
      await restore.commit();
      // 46d: o arhivă completă nu se termină cu un toast imediat — RestoreDoneDialog ia locul
      // Drawer-ului și arată de ce (reîncărcare obligatorie), toast-ul vine abia după.
      if (restore.restoredArchive) return;
      toast.show({
        message:
          restore.source === 'extern' ? 'Datele au fost restaurate din folderul extern.' : 'Datele au fost restaurate.',
      });
    } catch (error) {
      toast.show({ message: toUserError(error) });
    }
  }

  function reloadAfterRestore() {
    if (!restore.restoredArchive) return;
    writeRestoreDoneNote({ createdAt: restore.restoredArchive.createdAt });
    window.location.reload();
  }

  if (!backupData.ready) return <LoadingState />;

  return (
    <>
      <div className={styles.tabsRow}>
        <SegmentedControl
          ariaLabel="Filă Backup și setări"
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: 'backup', label: 'Backup' },
            { value: 'curs', label: 'Planuri și curs' },
            { value: 'kindergarten', label: 'Grădinița' },
            { value: 'branches', label: 'Filiale' },
            { value: 'sync', label: 'Sincronizare' },
            { value: 'pool', label: 'Bazin' },
            { value: 'services', label: 'Servicii' },
          ]}
        />
        {/* Versiunea nu mai stă lângă logo (17-filiale.md 13a) — apare aici, în antetul filei. */}
        <span className={styles.version}>Startica v{session.state.version}</span>
      </div>

      {viewMode === 'curs' ? (
        <ExchangeRateSettings />
      ) : viewMode === 'kindergarten' ? (
        <KindergartenSettings />
      ) : viewMode === 'branches' ? (
        <BranchesSettings />
      ) : viewMode === 'sync' ? (
        <SyncSettings />
      ) : viewMode === 'pool' ? (
        <PoolSettings />
      ) : viewMode === 'services' ? (
        <ServicesSettings />
      ) : (
        <>
          {backupData.health && (
            <div className={styles.statusRow}>
              <Card tone="mint" className={styles.statusCard}>
                <span className={styles.statusLabel}>① Date salvate</span>
                <span className={styles.statusHeadline}>Salvare automată</span>
                <span className={styles.statusSubtitle}>Bază: {backupData.health.database}</span>
              </Card>
              {[localBackupCard(backupData.health), externalBackupCard(backupData.health)].map(card => (
                <Card
                  key={card.label}
                  tone={card.tone}
                  className={[
                    styles.statusCard,
                    card.warning && card.tone === 'yellow' ? styles.statusCardWarningYellow : '',
                    card.warning && card.tone === 'pink' ? styles.statusCardWarningPink : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className={styles.statusLabel}>{card.label}</span>
                  <span className={styles.statusHeadline}>{card.headline}</span>
                  <span className={styles.statusSubtitle}>{card.subtitle}</span>
                  {card.label === '③ Copie externă' && card.warning && (
                    <Button className={styles.statusCta} onClick={focusExternalDirInput}>
                      Alege un stick sau un folder
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          )}

          <div className={styles.mainGrid}>
            <Card className={styles.listCard}>
              <div className={styles.listHeader}>
                <h3 className={styles.panelTitle}>Copii de siguranță</h3>
                <Button variant="outline" disabled={backupData.backupBusy} onClick={() => void backupNow()}>
                  Backup acum
                </Button>
              </div>

              {backupsList.loading && <p className={styles.notice}>Se încarcă…</p>}
              {!backupsList.loading && backupsList.entries.length > 0 && (
                <div className={styles.backupRows}>
                  {backupsList.entries.map(entry => (
                    <div className={styles.backupRow} key={entry.name}>
                      <span className={styles.backupDate}>{formatDateTime(entry.modified)}</span>
                      <span className={styles.backupSize}>
                        {typeof entry.bytes === 'number' ? formatFileSize(entry.bytes) : '—'}
                      </span>
                      <Button variant="link" onClick={() => backupPreview.open(entry)}>
                        Vezi conținutul
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {/* §7 (PROMPT-11, audit „secțiuni ascunse”): o listă fără backup-uri nu mai e un
                  gol tăcut sub antet — un rând explică starea. */}
              {!backupsList.loading && backupsList.entries.length === 0 && (
                <EmptyState
                  variant={EMPTY_STATES['backup.first'].variant}
                  size="compact"
                  title={resolveEmptyStateTitle(EMPTY_STATES['backup.first'])}
                />
              )}

              <Badge tone={STATUS_TONE[backupData.statusTone]}>{backupData.statusLabel}</Badge>
              <div className={styles.details}>
                {backupData.detailLines.map(line => (
                  <p key={line}>{line}</p>
                ))}
              </div>

              <form className={styles.form} autoComplete="off" onSubmit={event => void saveSettings(event)}>
                <Field label="Folder Google Drive sau altă destinație externă" htmlFor="backup-external-dir">
                  <TextInput
                    id="backup-external-dir"
                    inputRef={externalDirInputRef}
                    value={backupData.externalDirInput}
                    onChange={backupData.setExternalDirInput}
                    placeholder="G:\My Drive\Startica_Backup"
                  />
                </Field>
                <p className={styles.hint}>
                  Folderul trebuie să existe. Aplicația verifică fișierul copiat; confirmă sincronizarea în Google
                  Drive. Copiile externe urmează aceeași păstrare ca cele locale; coșul Google Drive le mai ține 30 de
                  zile. Cu mai multe filiale, folosește un subfolder pe filială, ex. „G:\My
                  Drive\Startica_Backup\Botanica” — folderul de date sau backup al altei filiale nu poate fi folosit ca
                  destinație externă.
                </p>
                {backupData.settingsError && <p className={styles.error}>{backupData.settingsError}</p>}
                <Button type="submit" disabled={backupData.settingsBusy}>
                  Salvează și testează copia
                </Button>
              </form>

              <div className={styles.toolbar}>
                <Button variant="ghost" onClick={restore.openDialog}>
                  Restaurare
                </Button>
                <Button variant="ghost" disabled={backupData.diagnosticBusy} onClick={() => void downloadDiagnostic()}>
                  Raport de diagnostic
                </Button>
              </div>
            </Card>

            <Card className={styles.excelCard}>
              <h3 className={styles.panelTitle}>Import și export</h3>
              <p className={styles.notice}>
                Importul înlocuiește datele numai după previzualizare, confirmare și backup. Exportul complet păstrează
                câmpurile și poate fi reimportat.
              </p>
              <div className={styles.toolbar}>
                <Button variant="ghost" onClick={excel.importDialog.openDialog}>
                  Import Excel
                </Button>
                <Button variant="ghost" disabled={excel.exporting} onClick={() => void exportExcel()}>
                  Export Excel complet
                </Button>
              </div>
            </Card>
          </div>
        </>
      )}

      <ExcelImportDialog data={excel.importDialog} onClose={excel.importDialog.closeDialog} />

      <Drawer
        open={restore.open}
        title="Restaurare"
        size="detail"
        onClose={restore.closeDialog}
        footer={
          <Button disabled={!restore.canCommit || restore.committing} onClick={() => void commitRestore()}>
            Restaurează
          </Button>
        }
      >
        <div className={styles.field}>
          Sursă
          <SegmentedControl
            ariaLabel="Sursă"
            value={restore.source}
            onChange={restore.setSource}
            options={[
              { value: 'local', label: 'Backupuri locale' },
              { value: 'extern', label: 'Din folderul extern' },
            ]}
          />
        </div>

        {restore.source === 'extern' && (
          <div className={styles.externalFields}>
            <Field label="Folderul extern (calea completă)" htmlFor="restore-external-folder">
              <TextInput
                id="restore-external-folder"
                value={restore.externalFolder}
                onChange={restore.setExternalFolder}
                placeholder="ex. G:\My Drive\Startica-backup"
              />
            </Field>
            <Button variant="ghost" onClick={() => void restore.loadExternalBackups()}>
              Caută copii
            </Button>
            <p className={styles.notice}>
              Startica nu poate confirma sincronizarea: verifică în Google Drive că fișierul are bifa verde (descărcat).
            </p>
          </div>
        )}

        <Field label="Backup" htmlFor="restore-backup-name">
          <Select
            id="restore-backup-name"
            value={restore.selectedName}
            onChange={restore.setSelectedName}
            options={restore.options.map(option => ({ value: option.name, label: option.label }))}
          />
        </Field>

        {restore.loadingBackups && <p className={styles.notice}>Se încarcă…</p>}
        {restore.backupsError && <p className={styles.error}>{restore.backupsError}</p>}
        {restore.staleFolderNotice && <p className={styles.notice}>{restore.staleFolderNotice}</p>}

        {restore.preview && (
          <div className={styles.preview}>
            <p>{restore.preview.summaryLine}</p>
            <p>{restore.preview.totalsLine}</p>
            {restore.preview.notes.map(note => (
              <p key={note} className={styles.notice}>
                {note}
              </p>
            ))}
            {restore.preview.errors.map(error => (
              <p key={error} className={styles.error}>
                {error}
              </p>
            ))}
          </div>
        )}
        {restore.previewError && <p className={styles.error}>{restore.previewError}</p>}

        <Field label="Scrie RESTAUREAZA" htmlFor="restore-confirm-text">
          <TextInput id="restore-confirm-text" value={restore.confirmText} onChange={restore.setConfirmText} />
        </Field>
      </Drawer>

      <Drawer open={!!backupPreview.target} title="Conținutul backupului" size="detail" onClose={backupPreview.close}>
        {backupPreview.target && (
          <BackupPreviewTable
            loading={backupPreview.loading}
            error={backupPreview.error}
            onRetry={() => backupPreview.target && backupPreview.open(backupPreview.target)}
            fileName={backupPreview.target.name}
            createdAt={backupPreview.preview?.createdAt}
            appVersion={backupPreview.preview?.appVersion}
            databases={backupPreview.preview?.databases ?? []}
          />
        )}
      </Drawer>

      <RestoreDoneDialog
        open={!!restore.restoredArchive}
        branchCount={restore.restoredArchive?.branchCount ?? 0}
        onReload={reloadAfterRestore}
      />
    </>
  );
}
