import { useEffect, useState } from 'react';
import { requestJson } from '@shared/api/session';

export interface PinStatusData {
  status: 'loading' | 'ready' | 'failed';
  configured: boolean;
  unlocked: boolean;
  reload: () => Promise<void>;
  unlock: (pin: string) => Promise<{ ok: boolean; message: string }>;
  lock: () => Promise<void>;
  /** Setează sau schimbă PIN-ul — `currentPin` e obligatoriu când unul e deja configurat. */
  set: (pin: string, currentPin?: string) => Promise<{ ok: boolean; message: string }>;
}

/** Starea PIN-ului administrator (23d) — deblocare în procesul serverului, glisată 10 min. */
export function usePinStatus(): PinStatusData {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [configured, setConfigured] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  async function load() {
    setStatus('loading');
    try {
      const response = (await requestJson('/api/personal/pin')) as { configured: boolean; unlocked: boolean };
      setConfigured(response.configured);
      setUnlocked(response.unlocked);
      setStatus('ready');
    } catch {
      setStatus('failed');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function unlock(pin: string): Promise<{ ok: boolean; message: string }> {
    try {
      await requestJson('/api/personal/pin/unlock', { pin });
      setUnlocked(true);
      return { ok: true, message: '' };
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    }
  }

  async function lock() {
    await requestJson('/api/personal/pin/lock', {});
    setUnlocked(false);
  }

  async function set(pin: string, currentPin?: string): Promise<{ ok: boolean; message: string }> {
    try {
      await requestJson('/api/personal/pin', { pin, currentPin });
      await load();
      return { ok: true, message: '' };
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    }
  }

  return { status, configured, unlocked, reload: load, unlock, lock, set };
}
