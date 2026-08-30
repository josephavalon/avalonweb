-- Forward hardening for installations that already recorded migrations 047
-- and 048 before their clean-install definitions were strengthened.

do $$
begin
  if to_regclass('public.nurse_invoices') is null
     or to_regclass('public.nurse_invoice_lines') is null
     or to_regclass('public.nurse_invoice_receipts') is null
     or to_regclass('public.nurse_invoice_status_events') is null then
    raise exception using errcode = 'P0001', message = 'migration_047_required';
  end if;
  if to_regclass('public.bd_companies') is null
     or to_regclass('public.bd_agent_identities') is null
     or to_regclass('public.bd_people') is null
     or to_regclass('public.bd_opportunities') is null
     or to_regclass('public.robbot3k_prospects') is null then
    raise exception using errcode = 'P0001', message = 'migration_048_required';
  end if;
  if to_regclass('public.provider_route_days') is null then
    raise exception using errcode = 'P0001', message = 'migration_051_required';
  end if;
  if to_regclass('public.audit_events') is null then
    raise exception using errcode = 'P0001', message = 'audit_events_required';
  end if;
  if to_regprocedure('public.record_nurse_invoice_receipt_scan(uuid,uuid,text,text,text,text)') is null
     and exists (
    select 1 from public.nurse_invoice_receipts
    where scan_status <> 'quarantined'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'preexisting_receipt_scans_require_security_review';
  end if;
end $$;

-- Invoice children need a tenant-scoped parent identity. Building this unique
-- index can be the longest step; the guard avoids rebuilding it on reruns.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.nurse_invoices'::regclass
      and conname = 'nurse_invoices_tenant_id_id_key'
  ) then
    alter table public.nurse_invoices
      add constraint nurse_invoices_tenant_id_id_key unique (tenant_id, id);
  end if;
end $$;

-- Add all material 047/048 tenant relationships unvalidated first, then fail
-- closed during validation if historical data crosses tenant boundaries.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.nurse_invoice_lines'::regclass and conname = 'nurse_invoice_lines_invoice_tenant_fk') then
    alter table public.nurse_invoice_lines add constraint nurse_invoice_lines_invoice_tenant_fk
      foreign key (tenant_id, invoice_id) references public.nurse_invoices(tenant_id, id)
      on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.nurse_invoice_receipts'::regclass and conname = 'nurse_invoice_receipts_invoice_tenant_fk') then
    alter table public.nurse_invoice_receipts add constraint nurse_invoice_receipts_invoice_tenant_fk
      foreign key (tenant_id, invoice_id) references public.nurse_invoices(tenant_id, id)
      on delete cascade not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.nurse_invoice_status_events'::regclass and conname = 'nurse_invoice_status_events_invoice_tenant_fk') then
    alter table public.nurse_invoice_status_events add constraint nurse_invoice_status_events_invoice_tenant_fk
      foreign key (tenant_id, invoice_id) references public.nurse_invoices(tenant_id, id)
      on delete cascade not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.bd_companies'::regclass and conname = 'bd_companies_created_agent_fk') then
    alter table public.bd_companies add constraint bd_companies_created_agent_fk
      foreign key (tenant_id, created_by_agent_id)
      references public.bd_agent_identities(tenant_id, id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.bd_companies'::regclass and conname = 'bd_companies_updated_agent_fk') then
    alter table public.bd_companies add constraint bd_companies_updated_agent_fk
      foreign key (tenant_id, updated_by_agent_id)
      references public.bd_agent_identities(tenant_id, id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.robbot3k_prospects'::regclass and conname = 'robbot3k_prospects_bd_company_fk') then
    alter table public.robbot3k_prospects add constraint robbot3k_prospects_bd_company_fk
      foreign key (tenant_id, company_id)
      references public.bd_companies(tenant_id, id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.robbot3k_prospects'::regclass and conname = 'robbot3k_prospects_bd_person_fk') then
    alter table public.robbot3k_prospects add constraint robbot3k_prospects_bd_person_fk
      foreign key (tenant_id, person_id)
      references public.bd_people(tenant_id, id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.robbot3k_prospects'::regclass and conname = 'robbot3k_prospects_bd_opportunity_fk') then
    alter table public.robbot3k_prospects add constraint robbot3k_prospects_bd_opportunity_fk
      foreign key (tenant_id, opportunity_id)
      references public.bd_opportunities(tenant_id, id) on delete restrict not valid;
  end if;
end $$;

alter table public.nurse_invoice_lines validate constraint nurse_invoice_lines_invoice_tenant_fk;
alter table public.nurse_invoice_receipts validate constraint nurse_invoice_receipts_invoice_tenant_fk;
alter table public.nurse_invoice_status_events validate constraint nurse_invoice_status_events_invoice_tenant_fk;
alter table public.bd_companies validate constraint bd_companies_created_agent_fk;
alter table public.bd_companies validate constraint bd_companies_updated_agent_fk;
alter table public.robbot3k_prospects validate constraint robbot3k_prospects_bd_company_fk;
alter table public.robbot3k_prospects validate constraint robbot3k_prospects_bd_person_fk;
alter table public.robbot3k_prospects validate constraint robbot3k_prospects_bd_opportunity_fk;

-- The immutable trigger now permits one tightly-scoped scanner transition. The
-- receipt bytes and all identifying metadata remain immutable, and direct Data
-- API UPDATE/DELETE privileges are removed below.
create or replace function app_private.prevent_nurse_invoice_delete_or_line_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_schema = 'public'
     and tg_table_name = 'nurse_invoice_receipts'
     and tg_op = 'INSERT'
  then
    if new.scan_status <> 'quarantined'
       or new.scanned_at is not null
       or new.scanner_provider is not null
       or new.scanner_reference is not null
    then
      raise exception using errcode = 'P0001', message = 'receipt_must_begin_quarantined';
    end if;
    return new;
  end if;
  if tg_table_schema = 'public'
     and tg_table_name = 'nurse_invoice_receipts'
     and tg_op = 'UPDATE'
     and current_setting('avalon.receipt_scanner_receipt_id', true) = old.id::text
  then
    if old.id is distinct from new.id
       or old.tenant_id is distinct from new.tenant_id
       or old.invoice_id is distinct from new.invoice_id
       or old.receipt_index is distinct from new.receipt_index
       or old.storage_path is distinct from new.storage_path
       or old.file_name is distinct from new.file_name
       or old.content_type is distinct from new.content_type
       or old.byte_size is distinct from new.byte_size
       or old.checksum_sha256 is distinct from new.checksum_sha256
       or old.created_at is distinct from new.created_at
       or old.scan_status <> 'quarantined'
       or new.scan_status not in ('cleared', 'blocked')
       or new.scanned_at is null
       or nullif(trim(new.scanner_provider), '') is null
       or nullif(trim(new.scanner_reference), '') is null
    then
      raise exception using errcode = 'P0001', message = 'invalid_receipt_scanner_transition';
    end if;
    return new;
  end if;
  raise exception using errcode = 'P0001', message = 'submitted_invoice_records_are_append_only';
end;
$$;

revoke all on function app_private.prevent_nurse_invoice_delete_or_line_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists nurse_invoice_receipts_immutable on public.nurse_invoice_receipts;
create trigger nurse_invoice_receipts_immutable
  before insert or update or delete on public.nurse_invoice_receipts
  for each row execute function app_private.prevent_nurse_invoice_delete_or_line_mutation();

revoke all on public.nurse_invoice_receipts
  from public, anon, authenticated, service_role;
grant select, insert on public.nurse_invoice_receipts to service_role;

create or replace function public.record_nurse_invoice_receipt_scan(
  p_tenant_id uuid,
  p_receipt_id uuid,
  p_expected_checksum_sha256 text,
  p_scan_status text,
  p_scanner_provider text,
  p_scanner_reference text
)
returns public.nurse_invoice_receipts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt public.nurse_invoice_receipts%rowtype;
  v_status text := lower(trim(coalesce(p_scan_status, '')));
  v_provider text := trim(coalesce(p_scanner_provider, ''));
  v_reference text := trim(coalesce(p_scanner_reference, ''));
begin
  if coalesce(p_expected_checksum_sha256, '') !~ '^[0-9a-f]{64}$'
     or v_status not in ('cleared', 'blocked')
     or char_length(v_provider) not between 1 and 120
     or char_length(v_reference) not between 1 and 240 then
    raise exception using errcode = '22023', message = 'invalid_receipt_scan_result';
  end if;

  select * into v_receipt
  from public.nurse_invoice_receipts r
  where r.tenant_id = p_tenant_id and r.id = p_receipt_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'receipt_not_found';
  end if;
  if v_receipt.checksum_sha256 <> p_expected_checksum_sha256 then
    raise exception using errcode = 'P0001', message = 'receipt_checksum_mismatch';
  end if;
  if v_receipt.scan_status = v_status
     and v_receipt.scanned_at is not null
     and v_receipt.scanner_provider = v_provider
     and v_receipt.scanner_reference = v_reference then
    return v_receipt;
  end if;
  if v_receipt.scan_status <> 'quarantined' then
    raise exception using errcode = 'P0001', message = 'receipt_scan_already_final';
  end if;

  perform set_config('avalon.receipt_scanner_receipt_id', p_receipt_id::text, true);
  update public.nurse_invoice_receipts
  set scan_status = v_status,
      scanned_at = clock_timestamp(),
      scanner_provider = v_provider,
      scanner_reference = v_reference
  where tenant_id = p_tenant_id and id = p_receipt_id
  returning * into v_receipt;
  perform set_config('avalon.receipt_scanner_receipt_id', '', true);

  insert into public.audit_events (
    tenant_id, actor_profile_id, action, entity_type, entity_id,
    phi_touched, payload_hash, payload
  ) values (
    p_tenant_id,
    null,
    'nurse_invoice_receipt_' || v_status,
    'nurse_invoice_receipts',
    p_receipt_id,
    false,
    encode(digest(jsonb_build_object(
      'scan_status', v_status,
      'scanner_provider', v_provider,
      'scanner_reference', v_reference
    )::text, 'sha256'), 'hex'),
    jsonb_build_object(
      'scan_status', v_status,
      'scanner_provider', v_provider,
      'scanner_reference', v_reference
    )
  );
  return v_receipt;
end;
$$;

revoke all on function public.record_nurse_invoice_receipt_scan(uuid, uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_nurse_invoice_receipt_scan(uuid, uuid, text, text, text, text)
  to service_role;

comment on function public.record_nurse_invoice_receipt_scan(uuid, uuid, text, text, text, text) is
  'Service-only, checksum-bound, immutable transition from receipt quarantine to cleared or blocked.';
