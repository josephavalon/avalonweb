export type AvalonOsRole = 'admin' | 'staff' | 'nurse' | 'promoter' | 'client';

export type AvalonOsDomain =
  | 'care'
  | 'people'
  | 'clinical'
  | 'events'
  | 'inventory'
  | 'finance'
  | 'reports'
  | 'communications'
  | 'system'
  | 'settings'
  | 'integrations';

export type AvalonOsCapabilityKind = 'workflow' | 'document' | 'ledger' | 'report' | 'integration';
export type AvalonOsAdapterOperation = 'health' | 'import' | 'export' | 'sync' | 'retry' | 'disconnect';
export type AvalonOsAdapterStatus = 'healthy' | 'degraded' | 'action_required' | 'disconnected';

export interface AvalonOsError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface AvalonOsResponse<T> {
  ok: boolean;
  data: T | null;
  error: AvalonOsError | null;
  requestId: string | null;
}

export interface AvalonOsCapability {
  slug: string;
  label: string;
  domain: AvalonOsDomain;
  kind: AvalonOsCapabilityKind;
  description: string;
}

export interface AvalonOsRecord {
  id: string;
  tenant_id: string;
  capability: string;
  record_type: string;
  title: string;
  status: string;
  amount_cents: number | null;
  effective_at: string | null;
  assigned_profile_id: string | null;
  data: Record<string, unknown>;
  version: number;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AvalonOsPagination {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface AvalonOsImportResult {
  rowCount: number;
  columns: string[];
  validation: 'passed' | 'failed';
}

export interface AvalonOsAdapterHealth {
  provider: string;
  label: string;
  mode: 'sandbox' | 'manual' | 'disabled';
  status: AvalonOsAdapterStatus;
  action: string;
  missing: string[];
}

export interface AvalonOsAuditEvent {
  id: string;
  tenant_id: string;
  actor_profile_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  payload_hash: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AvalonOsReconciliationCase {
  id: string;
  provider: string;
  status: 'open' | 'investigating' | 'resolved' | 'ignored';
  errorCode: string | null;
  attemptCount: number;
  ownerProfileId: string | null;
  openedAt: string;
  resolvedAt: string | null;
}
