import { useState } from 'react';
import { Badge, Button, ConfirmDeleteDialog, Dialog, type BadgeTone } from '@shared/ui';
import { useAppSession } from '@shared/api/session';
import { completProfile, normalizeProfile, PRESET_LABELS } from '#shared/domain/computer-profile.mjs';
import { compareVersions } from '#shared/domain/version-compare.mjs';
import { ProfileEditor } from './ProfileEditor';
import type { SyncDevice } from './useSyncSettings';
import styles from './DevicesList.module.css';

type Profile = import('#shared/domain/computer-profile.mjs').ComputerProfile;

const presetLabels: Record<string, string> = PRESET_LABELS;

// §5 (PROMPT-CLAUDE-CODE-10 §5, punctul 4; Sincronizare.dc.html#36c): un ton pe preset, nu
// un singur „yellow” pentru toate (INTREBARI.md, simplificare V1 închisă acum). Recepție nu
// are o culoare dată în spec — „pink” păstrează fiecare preset vizual distinct de celelalte.
const PRESET_BADGE_TONES: Record<string, BadgeTone> = {
  complet: 'orange',
  educator: 'mint',
  receptie: 'pink',
  bazin: 'yellow',
  personalizat: 'blue',
};

export interface DevicesListProps {
  devices: SyncDevice[];
  onRevoke: (deviceId: string) => Promise<void>;
  /** §5.3 (36c): „Schimbă” din rândul calculatorului — lipsă într-un apelant care nu-l expune
   * încă (teste izolate); în acel caz, coloana Profil rămâne doar informativă, fără acțiune. */
  onChangeProfile?: (deviceId: string, profile: Profile) => Promise<void>;
  /** F26/37d (PROMPT-11 §4.4): versiunea minimă cerută de server, din `useSyncStatus().minVersion`
   * — „” cât timp acest calculator nu a primit încă niciun 426 (nu știm cu adevărat pragul). */
  minVersion?: string;
}

function daysOffline(lastSeenAt: string): number {
  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

/** Lista „Calculatoare conectate” (14b) — rândul propriu nu are „Deconectează”, celelalte cer confirmare. */
export function DevicesList({ devices, onRevoke, onChangeProfile, minVersion }: DevicesListProps) {
  const session = useAppSession();
  const [pendingRevoke, setPendingRevoke] = useState<SyncDevice | null>(null);
  // §5.3 (36c): dispozitivul al cărui profil e în curs de schimbare — non-null deschide dialogul.
  const [editingDevice, setEditingDevice] = useState<SyncDevice | null>(null);
  const [draftProfile, setDraftProfile] = useState<Profile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  function branchName(branchId: string | null): string | null {
    if (!branchId) return null;
    return session.state.branches.find(branch => branch.id === branchId)?.name ?? null;
  }

  async function confirmRevoke() {
    if (!pendingRevoke) return;
    await onRevoke(pendingRevoke.id);
    setPendingRevoke(null);
  }

  function openProfileEditor(device: SyncDevice) {
    setEditingDevice(device);
    setDraftProfile(normalizeProfile(device.profile ?? completProfile()));
  }

  async function saveProfile() {
    if (!editingDevice || !draftProfile || !onChangeProfile) return;
    setSavingProfile(true);
    try {
      await onChangeProfile(editingDevice.id, draftProfile);
      setEditingDevice(null);
      setDraftProfile(null);
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <div className={styles.list}>
      {devices.map(device => {
        const offlineDays = daysOffline(device.lastSeenAt);
        const branch = branchName(device.lastBranchId);
        // §5.3 (36c): lipsă = un calculator conectat înainte de profiluri, tratat ca Complet
        // (completProfile(), aceeași convenție ca pe server).
        const preset = (device.profile ?? completProfile()).preset;
        // F26/37d (PROMPT-11 §4.4): „oprite primele” declinat (fără sortare/banner) — doar
        // pastila pe rând, și doar când pragul chiar e cunoscut (minVersion nenul).
        const outdated = !!minVersion && !!device.version && compareVersions(device.version, minVersion) === -1;
        return (
          <div key={device.id} className={styles.row}>
            <span className={offlineDays > 0 ? `${styles.dot} ${styles.dotOffline}` : styles.dot} aria-hidden="true" />
            <div className={styles.info}>
              <span className={styles.name}>{device.name}</span>
              <span className={styles.meta}>
                {device.os}
                {device.version ? ` · v${device.version}` : ''}
                {branch ? ` · deschide de obicei Filiala ${branch}` : ''}
              </span>
              <span className={styles.status}>
                {offlineDays > 0 ? `Offline de ${offlineDays} zile` : 'Sincronizat'}
              </span>
            </div>
            {outdated && <Badge tone="pink">Versiune veche · sincronizare oprită</Badge>}
            <Badge tone={PRESET_BADGE_TONES[preset] ?? 'yellow'}>{presetLabels[preset] ?? preset}</Badge>
            {onChangeProfile && (
              <Button variant="ghost" onClick={() => openProfileEditor(device)}>
                Schimbă
              </Button>
            )}
            {!device.me && (
              <Button variant="ghost" className={styles.revoke} onClick={() => setPendingRevoke(device)}>
                Deconectează
              </Button>
            )}
          </div>
        );
      })}

      <ConfirmDeleteDialog
        open={!!pendingRevoke}
        title={`Deconectează ${pendingRevoke?.name ?? ''}`}
        description="Calculatorul nu va mai primi și nu va mai trimite date către acest server. Datele lui locale rămân neatinse."
        confirmWord="DECONECTEAZĂ"
        onConfirm={() => void confirmRevoke()}
        onCancel={() => setPendingRevoke(null)}
      />

      {editingDevice && draftProfile && (
        <Dialog
          open
          title={`Schimbă profilul · ${editingDevice.name}`}
          // Excepție documentată (44d): matricea de module (`ProfileEditor`) are nevoie de lățimea
          // unui Drawer „form”, nu de lățimea standard `--dialog` (440px).
          width={620}
          onClose={() => {
            setEditingDevice(null);
            setDraftProfile(null);
          }}
          cancelLabel="Renunță"
          primary={{ label: 'Salvează', type: 'button', loading: savingProfile, onClick: () => void saveProfile() }}
        >
          <ProfileEditor value={draftProfile} onChange={setDraftProfile} />
        </Dialog>
      )}
    </div>
  );
}
