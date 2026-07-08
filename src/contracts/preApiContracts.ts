export type AvalonRole = 'client' | 'rn' | 'np' | 'physician' | 'ops_manager' | 'admin';

export type IntegrationKey =
  | 'acuity'
  | 'stripe'
  | 'supabase'
  | 'hubspot'
  | 'nursys'
  | 'qualiphy'
  | 'mercury'
  | 'gusto'
  | 'quickbooks'
  | 'resend_sms';

export type GfeSource = 'avalon_np' | 'qualiphy' | 'manual_review' | 'not_required_yet';

export type VisitStatus =
  | 'draft'
  | 'scheduling_received'
  | 'intake_pending'
  | 'clearance_pending'
  | 'cleared'
  | 'nurse_assigned'
  | 'en_route'
  | 'in_treatment'
  | 'closeout_pending'
  | 'completed'
  | 'cancelled'
  | 'blocked';

export type IntegrationState = 'local_placeholder' | 'queued' | 'sent' | 'confirmed' | 'failed' | 'reconciled';

export interface PersonRef {
  id: string;
  role: AvalonRole;
  displayName?: string;
}

export interface AnnualGfeRecord {
  id: string;
  patientId: string;
  status: 'pending' | 'valid' | 'denied' | 'expired';
  source: GfeSource;
  validFrom?: string;
  validUntil?: string;
  providerRef?: PersonRef;
  externalRef?: string;
}

export interface BookingContract {
  id: string;
  ownerId: string;
  patientId: string;
  payerId?: string;
  memberId?: string;
  protocolKey: string;
  status: VisitStatus;
  address: string;
  zip: string;
  appointmentStartsAt?: string;
  acuityAppointmentId?: string;
  stripeCheckoutSessionId?: string;
  gfe?: AnnualGfeRecord;
  gfeRequired: boolean;
  assignedProviderId?: string;
  inventoryKitId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationHandoff {
  key: IntegrationKey;
  state: IntegrationState;
  localRecordId: string;
  externalRecordId?: string;
  idempotencyKey: string;
  lastAttemptAt?: string;
  failureReason?: string;
  reconciliationRequired: boolean;
}

export interface InventoryConsumptionContract {
  visitId: string;
  kitId: string;
  nurseId: string;
  protocolKey: string;
  items: Array<{
    sku: string;
    name: string;
    expectedQty: number;
    actualQty?: number;
    unit: string;
  }>;
  lockedAt?: string;
}

export interface NotificationProofContract {
  id: string;
  channel: 'sms' | 'email' | 'in_app' | 'push';
  audience: 'client' | 'nurse' | 'np' | 'ops' | 'admin';
  recordId: string;
  state: 'queued' | 'sent' | 'delivered' | 'failed' | 'read' | 'acknowledged';
  providerMessageId?: string;
  updatedAt: string;
}
