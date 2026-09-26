import { useEffect, useState } from 'react';
import { requestJson } from '@shared/api/session';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '#shared/domain/notification-preferences.mjs';
import type { NotificationPreferences } from '#shared/domain/notification-preferences.mjs';

export type PreferencesScreenStatus = 'loading' | 'ready' | 'failed';

export interface NotificationPreferencesData {
  status: PreferencesScreenStatus;
  failureMessage: string;
  values: NotificationPreferences;
  setField: <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => void;
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
}

/** Preferințele sunt un singur obiect, salvat dintr-o bucată. */
export function useNotificationPreferences(): NotificationPreferencesData {
  const [status, setStatus] = useState<PreferencesScreenStatus>('loading');
  const [failureMessage, setFailureMessage] = useState('');
  const [saved, setSaved] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [values, setValues] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    requestJson('/api/notification-settings')
      .then(response => {
        if (cancelled) return;
        const preferences = response as NotificationPreferences;
        setSaved(preferences);
        setValues(preferences);
        setStatus('ready');
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setStatus('failed');
        setFailureMessage(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function setField<K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) {
    setValues(previous => ({ ...previous, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const response = await requestJson('/api/notification-settings', values);
      const preferences = response as NotificationPreferences;
      setSaved(preferences);
      setValues(preferences);
    } finally {
      setSaving(false);
    }
  }

  return {
    status,
    failureMessage,
    values,
    setField,
    dirty: JSON.stringify(values) !== JSON.stringify(saved),
    saving,
    save,
  };
}
