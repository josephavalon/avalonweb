-- Final fail-closed validation for the PayOps + Finance activation slice.
--
-- Migration 074 adds the terminal payroll constraints as NOT VALID so older
-- environments can install the control schema before reconciling legacy rows.
-- This migration is the explicit activation gate: it refuses to validate any
-- PAID or CANCELLED payroll row that lacks its required control evidence.

do $$
begin
  if to_regclass('public.payroll_runs') is null
     or not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.payroll_runs'::regclass
         and conname = 'payroll_runs_paid_evidence_check'
     )
     or not exists (
       select 1
       from pg_constraint
       where conrelid = 'public.payroll_runs'::regclass
         and conname = 'payroll_runs_cancel_control_check'
     ) then
    raise exception using errcode = 'P0001', message = 'payroll_activation_constraints_missing';
  end if;

  if exists (
    select 1
    from public.payroll_runs
    where status = 'PAID'
      and (
        last_reconciliation_event_id is null
        or last_bank_statement_item_id is null
        or last_reconciliation_match_id is null
        or paid_provider_payload_checksum is null
        or paid_provider_payload_checksum !~ '^[0-9a-f]{64}$'
        or paid_controller_profile_id is null
        or paid_evidence_recorded_at is null
      )
  ) then
    raise exception using errcode = 'P0001', message = 'payroll_paid_evidence_reconciliation_required';
  end if;

  if exists (
    select 1
    from public.payroll_runs
    where status = 'CANCELLED'
      and (
        cancelled_by is null
        or cancelled_at is null
        or cancel_reason_code is null
        or cancel_reason_code !~ '^[A-Z0-9_]{3,100}$'
      )
  ) then
    raise exception using errcode = 'P0001', message = 'payroll_cancel_control_reconciliation_required';
  end if;
end $$;

alter table public.payroll_runs
  validate constraint payroll_runs_paid_evidence_check;

alter table public.payroll_runs
  validate constraint payroll_runs_cancel_control_check;

comment on constraint payroll_runs_paid_evidence_check on public.payroll_runs is
  'Validated activation gate: PAID requires non-null reconciliation, bank, checksum, controller, and evidence timestamps.';

comment on constraint payroll_runs_cancel_control_check on public.payroll_runs is
  'Validated activation gate: CANCELLED requires a named actor, timestamp, and structured non-null reason code.';
