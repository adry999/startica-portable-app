import type { RecordsSnapshot, RecordType, RecordByType } from '#shared/contracts/record-types.mjs';
import type { RecordRepository, RevisionEnvelope, RunRevisionTransaction } from '#shared/contracts/persistence.mjs';
import type { AuditTrail } from '#shared/contracts/audit-trail.mjs';

/** Avertizare de conținut pentru o previzualizare de import; produsă de review-center. */
export interface ContentWarning {
  id?: string;
  reason: string;
}

export type FindRecordIssues = (records: RecordsSnapshot) => ContentWarning[];

export interface RecordsSummary {
  children: number;
  payments: number;
  expenses: number;
  groups: number;
  categories: number;
  paymentTotal: number;
  expenseTotal: number;
}

/** Rezultatul validării unei stări brute (Excel sau backup), înainte de confirmarea unui import. */
export interface ImportReport {
  state?: RecordsSnapshot;
  summary?: RecordsSummary;
  warnings: ContentWarning[];
  errors: string[];
}

export interface FinancialHistorySource {
  format: 'STARTICA_V5';
  sourceName: string;
  sourceHash: string;
  /** Stare brută, nevalidată — devine RecordsSnapshot abia după validateState(). */
  state: any;
}

export interface FinancialHistoryAdditions {
  payments: RecordByType['payments'][];
  expenses: RecordByType['expenses'][];
}

export interface FinancialHistoryPlan {
  additions: FinancialHistoryAdditions;
  skipped: { payments: number; expenses: number };
  mappedChildren: number;
  summary: {
    payments: number;
    expenses: number;
    paymentTotal: number;
    expenseTotal: number;
    unassigned: number;
    provisional: number;
  };
}

export interface DataTransferRoutesDependencies {
  recordRepository: RecordRepository;
  auditTrail: AuditTrail;
  runRevisionTransaction: RunRevisionTransaction;
  replaceAllRecords: (snapshot: RecordsSnapshot, action: string) => void;
  /** Starea curentă completă, cu revizia ei — folosită doar la previzualizare (fără scriere). */
  readEnvelope: () => RevisionEnvelope;
  findRecordIssues: FindRecordIssues;
}

export interface ExcelTransferControllerDependencies {
  elements: {
    importButton: HTMLButtonElement;
    excelInput: HTMLInputElement;
    importPreview: HTMLElement;
    importDialog: HTMLDialogElement;
    importConfirm: HTMLInputElement;
    commitImport: HTMLButtonElement;
    exportButton: HTMLButtonElement;
  };
  /** Obiectul de sesiune, mutabil și comun întregii interfețe; controller-ul citește și scrie `importData` prin referință. */
  sessionState: {
    revision: number;
    ready: boolean;
    pending: unknown;
    importData: { state: RecordsSnapshot; revision: number } | null;
  };
  readRecords: () => RecordsSnapshot;
  requestJson: (path: string, body?: unknown) => Promise<any>;
  submitMutation: (path: string, body: Record<string, unknown>, base?: number) => Promise<unknown>;
  showNotice: (message: string, isError?: boolean) => void;
  /** Încarcă la cerere modulul SheetJS vendorizat; același obiect e reținut cât timp e deja încărcat. */
  loadXlsx: () => Promise<any>;
  findRecordIssues: FindRecordIssues;
}
