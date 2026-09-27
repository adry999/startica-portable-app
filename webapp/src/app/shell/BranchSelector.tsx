import { useEffect, useRef, useState } from 'react';
import { requestJson } from '@shared/api/session';
import { branchInitials } from '#shared/domain/branch.mjs';
import styles from './BranchSelector.module.css';

export interface BranchSelectorBranch {
  id: string;
  name: string;
  color: string;
  address: string;
}

export interface BranchSelectorProps {
  branch: BranchSelectorBranch;
  branches: BranchSelectorBranch[];
  onSwitch: (branchId: string) => void;
  onManage: () => void;
}

interface BranchCounts {
  id: string;
  children: number;
}

/** Selectorul de filială din capul meniului lateral (13a, 17-filiale.md). */
export function BranchSelector({ branch, branches, onSwitch, onManage }: BranchSelectorProps) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<BranchCounts[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Contoarele („N copii · adresă”) sunt un plus informativ, cerute abia când
  // dropdown-ul se deschide — evită un GET /api/branches pe fiecare ecran.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    requestJson('/api/branches')
      .then(result => {
        if (!cancelled) setCounts(result.branches ?? []);
      })
      .catch(() => {
        // Rândurile rămân doar cu adresa — dropdown-ul funcționează și fără contoare.
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function pick(id: string) {
    setOpen(false);
    if (id !== branch.id) onSwitch(id);
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.trigger} ${styles[branch.color] ?? ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(previous => !previous)}
      >
        <span className={`${styles.square} ${styles[`sq-${branch.color}`] ?? ''}`}>{branchInitials(branch.name)}</span>
        <span className={styles.info}>
          <span className={styles.eyebrow}>Filiala</span>
          <span className={styles.name}>{branch.name}</span>
        </span>
        <span className={styles.caret} aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <div className={styles.dropdown} role="dialog" aria-label="Schimbă filiala">
          <p className={styles.dropdownTitle}>Schimbă filiala</p>
          {branches.map(item => {
            const count = counts.find(row => row.id === item.id);
            const meta = count ? `${count.children} copii · ${item.address}` : item.address;
            const current = item.id === branch.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`${styles.row} ${current ? styles.rowCurrent : ''}`}
                onClick={() => pick(item.id)}
              >
                <span className={`${styles.rowSquare} ${styles[`sq-${item.color}`] ?? ''}`}>
                  {branchInitials(item.name)}
                </span>
                <span className={styles.rowInfo}>
                  <span className={styles.rowName}>{item.name}</span>
                  <span className={styles.rowMeta}>{meta}</span>
                </span>
                {current && (
                  <span className={`${styles.check} ${styles[`ink-${item.color}`] ?? ''}`} aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
          <span className={styles.divider} />
          <button type="button" className={styles.manage} onClick={onManage}>
            Administrează filialele →
          </button>
        </div>
      )}
    </div>
  );
}
