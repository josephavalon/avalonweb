-- 005_idempotency_and_tenant.sql
-- Production hardening for webhook idempotency and Avalon tenant backfills.

insert into public.tenants (name, slug)
values ('Avalon Vitality', 'avalon-vitality')
on conflict (slug) do nothing;

update public.appointments
set tenant_id = (select id from public.tenants where slug = 'avalon-vitality')
where tenant_id is null;

update public.acuity_events
set tenant_id = (select id from public.tenants where slug = 'avalon-vitality')
where tenant_id is null;

update public.integration_events
set tenant_id = (select id from public.tenants where slug = 'avalon-vitality')
where tenant_id is null;

update public.reconciliation_cases
set tenant_id = (select id from public.tenants where slug = 'avalon-vitality')
where tenant_id is null;

create unique index if not exists uq_appointments_acuity_appointment_id
  on public.appointments (acuity_appointment_id)
  where acuity_appointment_id is not null;

create unique index if not exists uq_appointments_stripe_checkout_session_id
  on public.appointments (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists uq_appointments_stripe_deposit_payment_intent
  on public.appointments (stripe_deposit_payment_intent)
  where stripe_deposit_payment_intent is not null;

create unique index if not exists uq_appointments_stripe_balance_payment_intent
  on public.appointments (stripe_balance_payment_intent)
  where stripe_balance_payment_intent is not null;

create unique index if not exists uq_acuity_events_webhook_hash
  on public.acuity_events (webhook_event_hash);

create unique index if not exists uq_integration_events_provider_idempotency
  on public.integration_events (provider, idempotency_key);
