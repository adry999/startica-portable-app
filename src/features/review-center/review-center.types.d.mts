import type { Child, Payment } from '#shared/contracts/record-types.mjs';

export type ReviewFilter = [string, string];

export interface RecordIssue {
  type: 'children' | 'payments';
  id: string;
  name: string;
  reason: string;
}

export interface ReviewItem {
  type: 'children' | 'payments';
  id: string;
  name: string;
  record: Child | Payment;
  reasons: string[];
  categories: string[];
  canConfirm: boolean;
}

export interface ReviewProgress {
  total: number;
  confirmed: number;
  pending: number;
}

export interface ReviewCenter {
  items: ReviewItem[];
  progress: ReviewProgress;
  labels: Record<string, string>;
}
