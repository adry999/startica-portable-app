import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { smsStatusBadge, SmsStatusBadge } from './sms-status-badge';

describe('smsStatusBadge', () => {
  it('mapează fiecare stare la ton și etichetă', () => {
    expect(smsStatusBadge('sent')).toEqual({ tone: 'yellow', label: 'În curs' });
    expect(smsStatusBadge('delivered')).toEqual({ tone: 'mint', label: 'Livrat' });
    expect(smsStatusBadge('failed')).toEqual({ tone: 'pink', label: 'Eșuat' });
    expect(smsStatusBadge('unknown')).toEqual({ tone: 'neutral', label: 'Necunoscut' });
  });
});

describe('SmsStatusBadge', () => {
  it('randează eticheta corespunzătoare stării', () => {
    render(<SmsStatusBadge status="delivered" />);
    expect(screen.getByText('Livrat')).toBeInTheDocument();
  });
});
