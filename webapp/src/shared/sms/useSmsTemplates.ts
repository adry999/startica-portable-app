import { useEffect, useState } from 'react';
import { requestJson } from '@shared/api/session';
import type { SmsTemplateInputView, SmsTemplateView } from './sms-types';

export type SmsTemplatesScreenStatus = 'loading' | 'ready' | 'failed';

export interface SmsTemplatesData {
  status: SmsTemplatesScreenStatus;
  failureMessage: string;
  templates: SmsTemplateView[];
  defaultTemplate: SmsTemplateView | null;
  /** „Folosit de N ori" (14-sms.md §11b) — 0 pentru un șablon nou, nesalvat încă. */
  usageCountById: Record<string, number>;
  saving: boolean;
  save: (input: SmsTemplateInputView) => Promise<SmsTemplateView>;
  removing: boolean;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/** Lista de șabloane sms.md + salvare/ștergere, fiecare cu refresh după succes — vezi useTelegramStatus. */
export function useSmsTemplates(): SmsTemplatesData {
  const [status, setStatus] = useState<SmsTemplatesScreenStatus>('loading');
  const [failureMessage, setFailureMessage] = useState('');
  const [templates, setTemplates] = useState<SmsTemplateView[]>([]);
  const [usageCountById, setUsageCountById] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function refresh() {
    const response = (await requestJson('/api/sms-templates')) as {
      templates: SmsTemplateView[];
      usageCountById?: Record<string, number>;
    };
    setTemplates(response.templates);
    setUsageCountById(response.usageCountById ?? {});
    setStatus('ready');
  }

  useEffect(() => {
    let cancelled = false;
    refresh().catch((error: Error) => {
      if (cancelled) return;
      setStatus('failed');
      setFailureMessage(error.message);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(input: SmsTemplateInputView) {
    setSaving(true);
    try {
      const response = (await requestJson('/api/sms-template-save', input)) as { template: SmsTemplateView };
      await refresh();
      return response.template;
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setRemoving(true);
    try {
      await requestJson('/api/sms-template-delete', { id });
      await refresh();
    } finally {
      setRemoving(false);
    }
  }

  return {
    status,
    failureMessage,
    templates,
    defaultTemplate: templates.find(template => template.isDefault) ?? null,
    usageCountById,
    saving,
    save,
    removing,
    remove,
    refresh,
  };
}
