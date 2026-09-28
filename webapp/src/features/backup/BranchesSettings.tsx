import { useState, type FormEvent } from 'react';
import { Badge, Button, LoadingState, useToast } from '@shared/ui';
import { formatDateTime } from '#shared/format/date-format.mjs';
import { BRANCH_COLORS, branchInitials } from '@domain/branch.mjs';
import type { BranchSummary } from '@shared/api/branches';
import { useBranches } from './useBranches';
import backupStyles from './BackupPage.module.css';
import styles from './BranchesSettings.module.css';

/** Fila „Filiale” din Backup și setări (13c) — carduri cu redenumire și culoare. O filială nu se poate șterge. */
export function BranchesSettings() {
  const branchesData = useBranches();
  const toast = useToast();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addAddress, setAddAddress] = useState('');
  const [busy, setBusy] = useState(false);

  if (branchesData.status === 'failed')
    return (
      <div className={backupStyles.panel}>
        <p className={backupStyles.notice}>{branchesData.failureMessage || 'Filialele nu au putut fi încărcate.'}</p>
        <Button variant="outline" onClick={() => void branchesData.reload()}>
          Încearcă din nou
        </Button>
      </div>
    );
  if (!branchesData.ready) return <LoadingState />;

  function startRename(branch: BranchSummary) {
    setColorPickerId(null);
    setRenamingId(branch.id);
    setRenameValue(branch.name);
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue('');
  }

  async function saveRename() {
    if (!renamingId) return;
    setBusy(true);
    try {
      await branchesData.rename(renamingId, renameValue);
      setRenamingId(null);
    } catch (error) {
      toast.show({ message: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function chooseColor(id: string, color: string) {
    setColorPickerId(null);
    try {
      await branchesData.setColor(id, color);
    } catch (error) {
      toast.show({ message: (error as Error).message });
    }
  }

  async function submitAdd(event: FormEvent) {
    event.preventDefault();
    const name = addName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await branchesData.create({ name, address: addAddress.trim() || undefined });
      toast.show({ message: `Filiala ${name} a fost creată. O deschizi din selector.` });
      setAddOpen(false);
      setAddName('');
      setAddAddress('');
    } catch (error) {
      toast.show({ message: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.layout}>
      <div className={styles.header}>
        <h3 className={backupStyles.panelTitle}>Filiale</h3>
        <Button variant="outline" onClick={() => setAddOpen(current => !current)}>
          + Adaugă filială
        </Button>
      </div>

      {addOpen && (
        <form className={styles.addForm} onSubmit={event => void submitAdd(event)}>
          <label className={backupStyles.field}>
            Nume
            <input value={addName} onChange={event => setAddName(event.target.value)} placeholder="ex. Botanica" />
          </label>
          <label className={backupStyles.field}>
            Adresă
            <input
              value={addAddress}
              onChange={event => setAddAddress(event.target.value)}
              placeholder="ex. bd. Exemplu 5, Chișinău"
            />
          </label>
          <div className={backupStyles.toolbar}>
            <Button variant="ghost" type="button" onClick={() => setAddOpen(false)}>
              Anulează
            </Button>
            <Button type="submit" disabled={busy || !addName.trim()}>
              Creează filiala
            </Button>
          </div>
        </form>
      )}

      <div className={styles.list}>
        {branchesData.branches.map(branch => {
          const isCurrent = branch.id === branchesData.activeBranchId;
          const isRenaming = renamingId === branch.id;
          return (
            <div
              key={branch.id}
              className={styles.card}
              style={{ borderColor: isCurrent ? `var(--${branch.color})` : undefined, borderWidth: isCurrent ? 2 : 1 }}
            >
              <span className={styles.initials} style={{ background: `var(--${branch.color})` }}>
                {branchInitials(branch.name)}
              </span>
              <div className={styles.info}>
                {isRenaming ? (
                  <div className={styles.renameRow}>
                    <input
                      value={renameValue}
                      onChange={event => setRenameValue(event.target.value)}
                      aria-label={`Numele filialei ${branch.name}`}
                    />
                    <Button variant="ghost" onClick={cancelRename} disabled={busy}>
                      Anulează
                    </Button>
                    <Button onClick={() => void saveRename()} disabled={busy || !renameValue.trim()}>
                      Salvează
                    </Button>
                  </div>
                ) : (
                  <div className={styles.nameRow}>
                    <span className={styles.name}>{branch.name}</span>
                    {isCurrent && <Badge tone="mint">Deschisă acum</Badge>}
                  </div>
                )}
                <span className={styles.address}>{branch.address || '—'}</span>
                <span className={styles.meta}>
                  {branch.children} copii · {branch.groups} grupe · salvat {formatDateTime(branch.lastLocal)}
                </span>
                {colorPickerId === branch.id && (
                  <div className={styles.colorPicker} role="radiogroup" aria-label={`Culoarea filialei ${branch.name}`}>
                    {BRANCH_COLORS.map((color: string) => (
                      <button
                        key={color}
                        type="button"
                        role="radio"
                        aria-checked={branch.color === color}
                        aria-label={color}
                        className={styles.swatch}
                        style={{ background: `var(--${color})` }}
                        onClick={() => void chooseColor(branch.id, color)}
                      />
                    ))}
                  </div>
                )}
              </div>
              {!isRenaming && (
                <div className={styles.actions}>
                  <Button variant="outline" onClick={() => startRename(branch)}>
                    Redenumește
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setColorPickerId(current => (current === branch.id ? null : branch.id))}
                  >
                    Culoare
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className={backupStyles.hint}>
        Datele grădiniței, planurile și prețurile, șabloanele SMS și backup-ul se setează separat în fiecare filială,
        din filele Grădinița și Planuri și curs. O filială nu se poate șterge din aplicație.
      </p>
    </div>
  );
}
