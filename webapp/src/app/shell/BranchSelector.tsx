import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@shared/ui';
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; openUp: boolean } | null>(null);

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
      const target = event.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
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

  // Poziția vine din getBoundingClientRect (13a §2a) — dropdown-ul e portalat în body ca să
  // scape de overflow:auto + stacking context al .sidebar (position: sticky), care îl tăiau.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const dropdownHeight = dropdownRef.current?.offsetHeight ?? 320;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < dropdownHeight + 8 && rect.top > dropdownHeight + 8;
      const top = openUp ? rect.top - 8 - dropdownHeight : rect.bottom + 8;
      setPosition({ top, left: rect.left, openUp });
    }
    updatePosition();
    window.addEventListener('resize', updatePosition);
    // Scroll-ul sidebar-ului nu ajunge la window fără capture (nu bubble-uiește din containerul cu overflow).
    document.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, branches.length]);

  function pick(id: string) {
    setOpen(false);
    if (id !== branch.id) onSwitch(id);
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={triggerRef}
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
        <span className={styles.caret}>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} />
        </span>
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className={styles.dropdown}
            role="dialog"
            aria-label="Schimbă filiala"
            style={position ? { top: position.top, left: position.left } : { visibility: 'hidden' }}
          >
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
                    <span className={`${styles.check} ${styles[`ink-${item.color}`] ?? ''}`}>
                      <Icon name="check" size={14} />
                    </span>
                  )}
                </button>
              );
            })}
            <span className={styles.divider} />
            <button type="button" className={styles.manage} onClick={onManage}>
              Administrează filialele →
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
