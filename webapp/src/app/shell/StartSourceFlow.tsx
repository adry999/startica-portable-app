import { useState } from 'react';
import { Button, Card, Field, TextInput } from '@shared/ui';
import { requestJson, useAppSession } from '@shared/api/session';
import {
  BackupPreviewTable,
  RestoreDoneDialog,
  RestoreRejected,
  writeRestoreDoneNote,
  type BackupPreviewDatabaseRow,
  type RestoreRejectedItem,
} from '@features/backup';
import { StartSourceScreen, type StartSource } from './StartSourceScreen';
import styles from './StartSourceFlow.module.css';

const RESTORE_CONFIRMATION = 'RESTAUREAZA';

interface ArchiveDatabaseEntry {
  id: string;
  name: string;
  kind: 'branch' | 'common';
  counts: Record<string, number>;
}

interface BackupPreviewResponse {
  children: number;
  payments: number;
  expenses: number;
  notes?: string[];
  errors?: string[];
  archive?: boolean;
  appVersion?: string;
  createdAt?: string;
  databases?: ArchiveDatabaseEntry[];
}

/** Numele fișierului e tot ce rămâne după ultimul separator de cale — acceptă deopotrivă
 * `\` (Windows) și `/` (calea unui folder de rețea/Drive montat), ca restul aplicației. */
function splitPath(fullPath: string): { dir: string; name: string } {
  const trimmed = fullPath.trim();
  const index = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'));
  if (index < 0) return { dir: '', name: trimmed };
  return { dir: trimmed.slice(0, index), name: trimmed.slice(index + 1) };
}

function toDatabaseRows(databases: ArchiveDatabaseEntry[]): BackupPreviewDatabaseRow[] {
  return databases.map(entry => ({
    id: entry.id,
    name: entry.name,
    kind: entry.kind,
    children: entry.counts.children ?? 0,
    payments: entry.counts.payments ?? 0,
    expenses: entry.counts.expenses ?? 0,
  }));
}

export interface StartSourceFlowProps {
  /** „De la zero” — intră direct în aplicația goală, fără alți pași aici. */
  onDismiss: () => void;
  /** „Am Startica pe alt calculator” — deschide ecranul de conectare existent (14b);
   * ecranul acesta se ascunde la fel ca la „De la zero” (altfel acoperă conectarea). */
  onConnectElsewhere: () => void;
}

/** 46a–46d — primul ecran pe un calculator fără date: alegere, apoi (pentru „Din backup”)
 * previzualizare din manifest, respingere clară, și reîncărcare completă după restaurare. */
export function StartSourceFlow({ onDismiss, onConnectElsewhere }: StartSourceFlowProps) {
  const session = useAppSession();
  const [step, setStep] = useState<'choose' | 'backup'>('choose');
  const [filePath, setFilePath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<BackupPreviewResponse | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [committing, setCommitting] = useState(false);
  const [restored, setRestored] = useState<{ branchCount: number; createdAt: string } | null>(null);

  function handleContinue(source: StartSource) {
    if (source === 'scratch') {
      onDismiss();
      return;
    }
    if (source === 'connect') {
      onConnectElsewhere();
      return;
    }
    setStep('backup');
  }

  function resetPreview() {
    setPreview(null);
    setError('');
    setConfirmText('');
  }

  async function fetchPreview() {
    const { dir, name } = splitPath(filePath);
    if (!name) {
      setError('Scrie calea completă către fișier.');
      return;
    }
    resetPreview();
    setLoading(true);
    try {
      const query = `/api/backup-preview?name=${encodeURIComponent(name)}${dir ? `&dir=${encodeURIComponent(dir)}` : ''}`;
      const response = (await requestJson(query)) as BackupPreviewResponse;
      if (response.errors?.length) {
        setError(response.errors[0]);
        return;
      }
      setPreview(response);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function commitRestore() {
    if (!preview) return;
    const { dir, name } = splitPath(filePath);
    setCommitting(true);
    try {
      await session.mutate('/api/restore', { name, dir, confirm: confirmText });
      // Prima pornire nu are stare veche de păstrat — spre deosebire de Backup și setări
      // (useRestore.ts), aici orice restaurare reușită cere reîncărcarea completă: fie o
      // arhivă (pot apărea filiale noi), fie un `.db` vechi (prima filială adevărată a
      // calculatorului abia acum, ecranul de prima pornire nu are rost să mai apară).
      const branchCount = preview.databases?.filter(entry => entry.kind === 'branch').length ?? 1;
      setRestored({ branchCount, createdAt: preview.createdAt ?? '' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCommitting(false);
    }
  }

  function reload() {
    writeRestoreDoneNote({ createdAt: restored?.createdAt ?? '' });
    window.location.reload();
  }

  const legacyItems: RestoreRejectedItem[] =
    preview?.archive === false && (preview.notes?.length ?? 0) > 0
      ? [
          {
            tone: 'warning',
            title: 'Backup vechi (.db) · avertisment, se poate continua',
            message: preview.notes![0],
          },
        ]
      : [];

  if (step === 'choose') return <StartSourceScreen onContinue={handleContinue} />;

  return (
    <div className={styles.screen}>
      <Card className={styles.card}>
        <h2 className={styles.title}>Din backup</h2>
        <Field label="Calea completă către fișier" htmlFor="first-run-backup-path">
          <TextInput
            id="first-run-backup-path"
            value={filePath}
            onChange={setFilePath}
            placeholder={String.raw`C:\Users\...\startica_2026-10-01_arhiva.startica-backup`}
            onKeyDown={event => {
              if (event.key === 'Enter') void fetchPreview();
            }}
          />
        </Field>
        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => setStep('choose')}>
            ← Alt fișier
          </Button>
          <Button variant="outline" disabled={loading} onClick={() => void fetchPreview()}>
            Previzualizează
          </Button>
        </div>

        {loading && <BackupPreviewTable loading fileName="" databases={[]} />}

        {error && (
          <RestoreRejected items={[{ tone: 'blocked', title: 'Backup-ul nu poate fi restaurat', message: error }]} />
        )}

        {!error && preview && (
          <>
            {legacyItems.length > 0 && <RestoreRejected items={legacyItems} />}
            {preview.databases ? (
              <BackupPreviewTable
                fileName={splitPath(filePath).name}
                createdAt={preview.createdAt}
                appVersion={preview.appVersion}
                databases={toDatabaseRows(preview.databases)}
              />
            ) : (
              <p className={styles.summary}>
                {preview.children} copii · {preview.payments} achitări · {preview.expenses} cheltuieli
              </p>
            )}

            <Field label="Scrie RESTAUREAZA" htmlFor="first-run-confirm-text">
              <TextInput id="first-run-confirm-text" value={confirmText} onChange={setConfirmText} />
            </Field>
            <Button disabled={confirmText !== RESTORE_CONFIRMATION || committing} onClick={() => void commitRestore()}>
              Restaurează
            </Button>
          </>
        )}
      </Card>

      <RestoreDoneDialog open={!!restored} branchCount={restored?.branchCount ?? 1} onReload={reload} />
    </div>
  );
}
