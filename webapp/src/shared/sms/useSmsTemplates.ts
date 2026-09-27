import { useEffect, useState } from 'react';
import { requestJson } from '@shared/api/session';
import type { SmsTemplateInputView, SmsTemplateView } from './sms-types';

export type SmsTemplatesScreenStatus = 'loading' | 'ready' | 'failed';

export interface SmsTemplatesData {
  status: SmsTemplatesScreenStatus;
  failureMessage: string;
  templates: SmsTemplateView[];
  defaultTemplate: SmsTemplateView | null;
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
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function refresh() {
    const response = (await requestJson('/api/sms-templates')) as { templates: SmsTemplateView[] };
    setTemplates(response.templates);
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
    saving,
    save,
    removing,
    remove,
    refresh,
  };
}
