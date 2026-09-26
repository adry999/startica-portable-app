import type { FormEvent } from 'react';
import { Badge, Card, Drawer, useToast, type BadgeTone } from '@shared/ui';
import { useBackup, type HealthTone } from './useBackup';
import { useRestore } from './useRestore';
import { useExcelTransfer } from './useExcelTransfer';
import { ExcelImportDialog } from './ExcelImportDialog';
import styles from './BackupPage.module.css';

const STATUS_TONE: Record<HealthTone, BadgeTone> = { ok: 'mint', warning: 'yellow', error: 'pink' };

export function BackupPage() {
  const backupData = useBackup();
  const restore = useRestore(backupData.health?.externalDir ?? '');
  const excel = useExcelTransfer();
  const toast = useToast();

  async function exportExcel() {
    try {
      await excel.exportAll();
    } catch (error) {
      toast.show({ message: (error as Error).message });
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
      toast.show({ message: (error as Error).message });
    }
  }

  async function backupNow() {
    try {
      await backupData.backupNow();
      toast.show({ message: 'Backup local verificat creat.' });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function downloadDiagnostic() {
    try {
      await backupData.downloadDiagnostic();
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function commitRestore() {
    try {
      await restore.commit();
      toast.show({
        message:
          restore.source === 'extern' ? 'Datele au fost restaurate din folderul extern.' : 'Datele au fost restaurate.',
      });
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  if (!backupData.ready) return <p className={styles.notice}>Se încarcă starea backup-ului…</p>;

  return (
    <>
      <Card className={styles.panel}>
        <h3 className={styles.panelTitle}>Copii de siguranță</h3>
        <Badge tone={STATUS_TONE[backupData.statusTone]}>{backupData.statusLabel}</Badge>
        <div className={styles.details}>
          {backupData.detailLines.map(line => (
            <p key={line}>{line}</p>
          ))}
        </div>

        <form className={styles.form} onSubmit={event => void saveSettings(event)}>
          <label className={styles.field}>
            Folder Google Drive sau altă destinație externă
            <input
              value={backupData.externalDirInput}
              onChange={event => backupData.setExternalDirInput(event.target.value)}
              placeholder="G:\My Drive\Startica_Backup"
            />
          </label>
          <p className={styles.hint}>
            Folderul trebuie să existe. Aplicația verifică fișierul copiat; confirmă sincronizarea în Google Drive.
            Copiile externe urmează aceeași păstrare ca cele locale; coșul Google Drive le mai ține 30 de zile.
          </p>
          {backupData.settingsError && <p className={styles.error}>{backupData.settingsError}</p>}
          <button type="submit" className={styles.btnPrimary} disabled={backupData.settingsBusy}>
            Salvează și testează copia
          </button>
        </form>

        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.btnGhost}
            disabled={backupData.backupBusy}
            onClick={() => void backupNow()}
          >
            Backup acum
          </button>
          <button type="button" className={styles.btnGhost} onClick={restore.openDialog}>
            Restaurare
          </button>
          <button
            type="button"
            className={styles.btnGhost}
            disabled={backupData.diagnosticBusy}
            onClick={() => void downloadDiagnostic()}
          >
            Raport de diagnostic
          </button>
        </div>
      </Card>

      <Card className={styles.panel}>
        <h3 className={styles.panelTitle}>Excel</h3>
        <p className={styles.notice}>
          Importul înlocuiește datele numai după previzualizare, confirmare și backup. Exportul complet păstrează
          câmpurile și poate fi reimportat.
        </p>
        <div className={styles.toolbar}>
          <button type="button" className={styles.btnGhost} onClick={excel.importDialog.openDialog}>
            Import Excel
          </button>
          <button
            type="button"
            className={styles.btnGhost}
            disabled={excel.exporting}
            onClick={() => void exportExcel()}
          >
            Export Excel complet
          </button>
        </div>
      </Card>

      <ExcelImportDialog data={excel.importDialog} onClose={excel.importDialog.closeDialog} />

      <Drawer
        open={restore.open}
        title="Restaurare"
        width={520}
        onClose={restore.closeDialog}
        footer={
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={!restore.canCommit || restore.committing}
            onClick={() => void commitRestore()}
          >
            Restaurează
          </button>
        }
      >
        <fieldset className={styles.sourceField}>
          <legend>Sursă</legend>
          <label>
            <input
              type="radio"
              name="restoreSource"
              checked={restore.source === 'local'}
              onChange={() => restore.setSource('local')}
            />
            Backupuri locale
          </label>
          <label>
            <input
              type="radio"
              name="restoreSource"
              checked={restore.source === 'extern'}
              onChange={() => restore.setSource('extern')}
            />
            Din folderul extern
          </label>
        </fieldset>

        {restore.source === 'extern' && (
          <div className={styles.externalFields}>
            <label className={styles.field}>
              Folderul extern (calea completă)
              <input
                value={restore.externalFolder}
                onChange={event => restore.setExternalFolder(event.target.value)}
                placeholder="ex. G:\My Drive\Startica-backup"
              />
            </label>
            <button type="button" className={styles.btnGhost} onClick={() => void restore.loadExternalBackups()}>
              Caută copii
            </button>
            <p className={styles.notice}>
              Startica nu poate confirma sincronizarea: verifică în Google Drive că fișierul are bifa verde (descărcat).
            </p>
          </div>
        )}

        <label className={styles.field}>
          Backup
          <select value={restore.selectedName} onChange={event => restore.setSelectedName(event.target.value)}>
            {restore.options.map(option => (
              <option key={option.name} value={option.name}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

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

        <label className={styles.field}>
          Scrie RESTAUREAZA
          <input value={restore.confirmText} onChange={event => restore.setConfirmText(event.target.value)} />
        </label>
      </Drawer>
    </>
  );
}
