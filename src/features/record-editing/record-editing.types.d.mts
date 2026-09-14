import type { RecordType, RecordsSnapshot } from '#shared/contracts/record-types.mjs';
import type { RecordRepository, RevisionRequest, RunRevisionTransaction } from '#shared/contracts/persistence.mjs';
import type { AuditTrail } from '#shared/contracts/audit-trail.mjs';

/** Tipurile pt. care dialogul generic are un formular (grupele/categoriile au ecrane proprii). */
export type EditableRecordType = 'children' | 'payments' | 'expenses';

/** Contractul HTTP existent al /api/record; se păstrează neschimbat la migrare. */
export interface RecordSaveRequest extends RevisionRequest {
  type: RecordType;
  record: unknown;
  mode: 'create' | 'update';
}

/** Contractul HTTP existent al /api/record-delete; se păstrează neschimbat la migrare.
 *  Doar tipurile cu arhivare pot fi șterse definitiv (grupele/categoriile au rutele lor). */
export interface RecordDeleteRequest extends RevisionRequest {
  type: EditableRecordType;
  id: string;
}

export interface RecordEditingRoutesDependencies {
  recordRepository: RecordRepository;
  auditTrail: AuditTrail;
  runRevisionTransaction: RunRevisionTransaction;
}

/**
 * Ce primește un modul de câmpuri (*-editor-fields.mjs) la randare și la citire.
 * Injectat de dialog, ca field-urile să nu depindă de `session` sau de `window` direct.
 */
export interface RecordEditorContext {
  records: RecordsSnapshot;
  today: () => string;
  mode: 'create' | 'update';
  /** Fișa așa cum era la deschiderea formularului (înainte de orice editare). */
  previousRecord: any;
  /** Marchează formularul ca modificat — vezi `sessionState.editorDirty`. */
  markDirty: () => void;
  renderSaveStatus: () => void;
  /** Fereastră de confirmare nativă, injectată ca să fie testabilă. */
  confirm: (message: string) => boolean;
  /** Doar pt. expenses: sugestiile de categorie, injectate ca modulul să nu importe alt feature. */
  readExpenseCategoryNames?: () => string[];
}

/**
 * Interfața implementată structural de fiecare `*-editor-fields.mjs`
 * (children, payments, expenses). Field-urile NU importă `record-editing` —
 * dialogul le primește deja compuse din `src/app/web/main.mjs`, ca
 * feature-urile să rămână izolate unele de altele.
 */
export interface RecordEditorFields<TRecord = any> {
  /** Prefixul unui id nou la creare (ex. „ID”, „PAY”, „EXP”). */
  idPrefix: string;
  title(record: TRecord, mode: 'create' | 'update'): string;
  markup(record: TRecord, context: RecordEditorContext): string;
  /** Ascultătorii dinamici (istoric, repartizare, alegerea copilului etc.); opțional. */
  bind?(formElement: HTMLFormElement, context: RecordEditorContext): void;
  /** Întoarce fișa normalizată gata de trimis, sau `null` pt. a anula salvarea (ex. dublură neconfirmată). */
  read(
    formData: Record<string, FormDataEntryValue>,
    formElement: HTMLFormElement,
    context: RecordEditorContext,
  ): TRecord | null;
}

export interface RecordEditorDialogElements {
  editor: HTMLDialogElement;
  editorForm: HTMLFormElement;
  editorTitle: HTMLElement;
  editorFields: HTMLElement;
  editorError: HTMLElement;
  editorSave: HTMLButtonElement;
}

export interface RecordEditorEntry {
  type: EditableRecordType;
  record: any;
  mode: 'create' | 'update';
  revision: number;
}

/** Doar câmpurile din starea sesiunii pe care dialogul le citește sau le scrie. */
export interface RecordEditorSessionState {
  ready: boolean;
  pending: unknown;
  busy: boolean;
  revision: number;
  editor: RecordEditorEntry | null;
  editorDirty: boolean;
  saveError: string;
}

export interface RecordEditorDialogDependencies {
  elements: RecordEditorDialogElements;
  fieldsByType: Record<EditableRecordType, RecordEditorFields>;
  sessionState: RecordEditorSessionState;
  readRecords: () => RecordsSnapshot;
  submitMutation: (path: string, body: Record<string, unknown>, revision?: number) => Promise<unknown>;
  showNotice: (message: string, isError?: boolean) => void;
  renderSaveStatus: () => void;
  /** Doar pt. expenses; vezi RecordEditorContext.readExpenseCategoryNames. */
  readExpenseCategoryNames?: () => string[];
}
