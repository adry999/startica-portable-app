import { useMemo } from 'react';
import { useAppSession } from '@shared/api/session';
import { Button, useDelayedLoading } from '@shared/ui';
import styles from './StartupScreen.module.css';

const REVEAL_DELAY_MS = 1000;
const TOO_SLOW_DELAY_MS = 15000;

// Fără server comun în această etapă (vezi docs/design/INTREBARI.md), calea de backup
// nu poate fi cerută printr-un API când baza locală nu se deschide — serverul nu ajunge
// să pornească, deci nici acest ecran nu are cum să ceară calea reală. Arătăm calea
// implicită ca text (vezi docs/arhitectura, %LOCALAPPDATA%\Startica).
const DEFAULT_BACKUP_PATH = String.raw`%LOCALAPPDATA%\Startica\Startica_Backup`;

interface StepView {
  key: string;
  label: string;
  status: 'done' | 'current' | 'pending';
  duration: string;
}

function formatDuration(elapsedMs: number | null): string {
  if (elapsedMs === null) return '';
  return `${(elapsedMs / 1000).toFixed(1).replace('.', ',')} s`;
}

/** Pașii vin din evenimente reale ale sesiunii (startupTimings), nu dintr-un timer separat. */
function useStartupSteps() {
  const session = useAppSession();
  const { startedAt, serverAt, databaseAt, syncAt } = session.state.startupTimings;
  const ready = session.state.ready;
  // Pasul de sincronizare (18-sincronizare.md) apare doar când sync.json există —
  // o instalare neconfigurată vede exact pașii de astăzi, fără nicio linie nouă.
  const syncConfigured = !!session.state.sync?.configured;
  const syncOffline = session.state.sync?.configured && session.state.sync.connection === 'offline';
  const syncLabel = syncOffline ? 'Fără internet — lucrezi cu datele locale' : 'Sincronizez cu serverul comun';
  const lastKnownAt = syncConfigured ? syncAt : databaseAt;

  const steps = useMemo<StepView[]>(() => {
    const entries: { key: string; label: string; at: number | null }[] = [
      { key: 'server', label: 'Pornesc serverul local', at: serverAt },
      { key: 'database', label: 'Citesc baza de date', at: databaseAt },
      ...(syncConfigured ? [{ key: 'sync', label: syncLabel, at: syncAt }] : []),
      { key: 'dashboard', label: 'Pregătesc Dashboard-ul', at: ready ? lastKnownAt : null },
    ];
    let currentAssigned = false;
    return entries.map(entry => {
      if (entry.at) {
        return {
          key: entry.key,
          label: entry.label,
          status: 'done' as const,
          duration: formatDuration(startedAt ? entry.at - startedAt : null),
        };
      }
      if (!currentAssigned) {
        currentAssigned = true;
        return { key: entry.key, label: entry.label, status: 'current' as const, duration: '' };
      }
      return { key: entry.key, label: entry.label, status: 'pending' as const, duration: '' };
    });
  }, [startedAt, serverAt, databaseAt, syncConfigured, syncAt, syncLabel, lastKnownAt, ready]);

  return { steps, session };
}

/** Randată de AppShell cât timp sesiunea nu are snapshot-ul (21a). Nimic vizibil sub 1 s;
 * după 15 s fără răspuns arată 21c; o eroare de încărcare arată varianta cu baza locală. */
export function StartupScreen() {
  const { steps, session } = useStartupSteps();
  const ready = session.state.ready;
  // Cât timp o reîncercare e în curs (session.loading), nu mai arătăm eroarea rămasă
  // de la tentativa anterioară — altfel „Încearcă din nou” n-ar mai avea niciun efect vizibil.
  const hasError = !ready && !session.state.loading && Boolean(session.state.saveError);
  const active = !ready && !hasError;
  const showScreen = useDelayedLoading(active, REVEAL_DELAY_MS);
  const showTooSlow = useDelayedLoading(active, TOO_SLOW_DELAY_MS);

  if (hasError) {
    return (
      <StartupError
        message={session.state.saveError}
        backupPath={(session.state.health as { backup?: string })?.backup || DEFAULT_BACKUP_PATH}
        onRetry={() => void session.load()}
      />
    );
  }
  if (!showScreen) return <div className={styles.blank} />;
  if (showTooSlow) return <StartupTooSlow onRetry={() => void session.load()} />;

  const doneCount = steps.filter(step => step.status === 'done').length;
  const pct = Math.round((doneCount / steps.length) * 100);
  // ALINIERE-DESIGN.md A8 „Încărcare 21a”: rândul sub bară arată pasul curent.
  const currentStepLabel = (steps.find(step => step.status === 'current') ?? steps[steps.length - 1])?.label ?? '';

  return (
    <div className={styles.screen}>
      <span className={styles.circleTopLeft} aria-hidden="true" />
      <span className={styles.circleBottomRight} aria-hidden="true" />
      <div className={styles.card}>
        <img src="/assets/startica-icon.svg" alt="" className={styles.icon} />
        <img src="/assets/startica-logo.svg" alt="Startica" className={styles.logo} />
        <div className={styles.progressGroup}>
          <div className={styles.progressTrack}>
            <span className={styles.progressBar} style={{ width: `${pct}%` }} />
          </div>
          <div className={styles.progressMeta}>
            <span className={styles.progressStepLabel}>{currentStepLabel}</span>
            <span>{pct}%</span>
          </div>
        </div>
        <ol className={styles.steps}>
          {steps.map(step => (
            <li key={step.key} className={`${styles.step} ${styles[step.status]}`}>
              <span className={styles.marker} aria-hidden="true">
                {step.status === 'done' ? '✓' : ''}
              </span>
              <span className={styles.label}>{step.label}</span>
              <span className={styles.duration}>{step.duration}</span>
            </li>
          ))}
        </ol>
        {/* Filiala e cunoscută din pasul 2 (/api/session a răspuns) — 21a. */}
        <span className={styles.version}>
          {session.state.branch ? `Filiala ${session.state.branch.name} · ` : ''}
          {session.state.version}
        </span>
      </div>
    </div>
  );
}

function StartupTooSlow({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.screen}>
      <span className={styles.circleTopLeftSmall} aria-hidden="true" />
      <div className={styles.messageCard}>
        <img src="/assets/startica-logo.svg" alt="Startica" className={styles.logoSmall} />
        <h2 className={styles.title}>Pornirea durează mai mult ca de obicei</h2>
        <p className={styles.explanation}>
          Citirea bazei de date locale durează neobișnuit de mult. Poți încerca din nou sau poți aștepta.
        </p>
        <Button onClick={onRetry}>Încearcă din nou</Button>
      </div>
    </div>
  );
}

function StartupError({ message, backupPath, onRetry }: { message: string; backupPath: string; onRetry: () => void }) {
  return (
    <div className={styles.screen}>
      <span className={styles.circleTopLeftSmall} aria-hidden="true" />
      <div className={styles.messageCard}>
        <img src="/assets/startica-logo.svg" alt="Startica" className={styles.logoSmall} />
        <h2 className={styles.title}>Datele nu s-au putut încărca</h2>
        <p className={styles.explanation}>{message}</p>
        <div className={styles.actions}>
          <Button onClick={onRetry}>Încearcă din nou</Button>
        </div>
        <p className={styles.backupNote}>
          Deschide dosarul cu backupuri: <code className={styles.backupPath}>{backupPath}</code>
        </p>
      </div>
    </div>
  );
}
