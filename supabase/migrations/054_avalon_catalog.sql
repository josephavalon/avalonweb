-- Avalon Catalog V1
--
-- One tenant-scoped Offering is rendered into client, nurse, event,
-- membership, partner, and operator contexts.  Catalog stores relationships
-- to Inventory; it never copies stock or becomes the inventory ledger.
--
-- IMPORTANT: this migration is schema/runtime foundation only.  It does not
-- seed production data or change an existing public menu.  The explicit
-- import + shadow-verification flow in api/admin/catalog.js is the only
-- supported cutover path.

create extension if not exists pgcrypto;

-- --------------------------------------------------------------------------
-- Master records
-- --------------------------------------------------------------------------

create table if not exists public.catalog_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  stable_key text not null check (stable_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text,
  icon text,
  image_url text,
  display_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  audience_visibility text[] not null default '{}',
  version integer not null default 1 check (version > 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, stable_key),
  unique (tenant_id, id)
);

create table if not exists public.catalog_offerings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  stable_key text not null check (stable_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  sku text,
  internal_name text not null check (char_length(trim(internal_name)) between 1 and 240),
  public_name text not null check (char_length(trim(public_name)) between 1 and 240),
  short_name text,
  offering_type text not null check (offering_type in (
    'iv_treatment', 'im_injection', 'add_on', 'service', 'product',
    'package', 'membership_benefit', 'event_offering', 'consultation',
    'fee', 'other'
  )),
  category_id uuid,
  status text not null default 'draft' check (status in ('draft', 'active', 'inactive', 'scheduled', 'archived')),
  description text,
  short_description text,
  internal_description text,
  tags text[] not null default '{}',
  estimated_duration_minutes integer check (estimated_duration_minutes is null or estimated_duration_minutes between 0 and 1440),
  display_order integer not null default 0,
  featured boolean not null default false,
  taxability text not null default 'non_taxable' check (taxability in ('taxable', 'non_taxable', 'conditional')),
  discount_eligible boolean not null default true,
  clinical_metadata jsonb not null default '{}'::jsonb,
  fulfillment_metadata jsonb not null default '{}'::jsonb,
  financial_metadata jsonb not null default '{}'::jsonb,
  schedule_metadata jsonb not null default '{}'::jsonb,
  imported_source text,
  imported_key text,
  version integer not null default 1 check (version > 0),
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, stable_key),
  unique (tenant_id, sku),
  unique (tenant_id, id),
  foreign key (tenant_id, category_id)
    references public.catalog_categories(tenant_id, id) on delete restrict
);

create index if not exists catalog_offerings_lookup_idx
  on public.catalog_offerings (tenant_id, status, offering_type, category_id, display_order);
create index if not exists catalog_offerings_tags_idx
  on public.catalog_offerings using gin (tags);

-- Audience-specific copy.  Internal/clinical fields live on the master record
-- and are projected only by server APIs; they are never selected client-side.
create table if not exists public.catalog_presentations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  offering_id uuid not null,
  audience text not null check (audience in (
    'client', 'nurse', 'np', 'physician', 'admin', 'event', 'membership',
    'partner', 'public', 'private_link', 'bd'
  )),
  enabled boolean not null default false,
  display_name text not null,
  description text,
  short_description text,
  nurse_instructions text,
  admin_notes text,
  benefits text[] not null default '{}',
  use_cases text[] not null default '{}',
  included_items text[] not null default '{}',
  hero_url text,
  thumbnail_url text,
  icon text,
  detail_path text,
  booking_path text,
  display_order integer not null default 0,
  featured boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, offering_id, audience),
  unique (tenant_id, id),
  foreign key (tenant_id, offering_id)
    references public.catalog_offerings(tenant_id, id) on delete cascade
);

-- Pricing rules are appendable/versioned.  Future-dated rows schedule changes;
-- bookings persist their resolved price and therefore never silently reprice.
create table if not exists public.catalog_prices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  offering_id uuid not null,
  rule_key text not null check (char_length(trim(rule_key)) between 1 and 160),
  price_type text not null check (price_type in (
    'standard', 'member', 'event', 'corporate', 'partner', 'location',
    'promotional', 'contract', 'custom'
  )),
  amount_cents bigint not null check (amount_cents >= 0),
  compare_at_cents bigint check (compare_at_cents is null or compare_at_cents >= amount_cents),
  minimum_allowed_cents bigint check (minimum_allowed_cents is null or minimum_allowed_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  priority integer not null default 100 check (priority between 0 and 10000),
  conditions jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('draft', 'scheduled', 'active', 'superseded', 'archived')),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  reason text not null check (char_length(trim(reason)) between 2 and 1000),
  version integer not null default 1 check (version > 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from),
  unique (tenant_id, offering_id, rule_key),
  unique (tenant_id, id),
  unique (tenant_id, offering_id, id),
  foreign key (tenant_id, offering_id)
    references public.catalog_offerings(tenant_id, id) on delete cascade
);

create index if not exists catalog_prices_resolution_idx
  on public.catalog_prices (tenant_id, offering_id, status, priority desc, effective_from desc);

create table if not exists public.catalog_visibility_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  offering_id uuid not null,
  audience text not null check (audience in (
    'client', 'nurse', 'np', 'physician', 'admin', 'event', 'membership',
    'partner', 'public', 'private_link', 'bd'
  )),
  enabled boolean not null default false,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  reason text not null check (char_length(trim(reason)) between 2 and 1000),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from),
  unique (tenant_id, offering_id, audience),
  foreign key (tenant_id, offering_id)
    references public.catalog_offerings(tenant_id, id) on delete cascade
);

-- Default is CLOSED.  A matching active allow rule is required.  Deny wins on
-- equal priority, and the server returns the exact rule used in admin traces.
create table if not exists public.catalog_availability_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  offering_id uuid not null,
  rule_key text not null,
  effect text not null check (effect in ('allow', 'deny')),
  audience text check (audience is null or audience in (
    'client', 'nurse', 'np', 'physician', 'admin', 'event', 'membership',
    'partner', 'public', 'private_link', 'bd'
  )),
  channel text,
  context_type text check (context_type is null or context_type in (
    'global', 'location', 'service_area', 'venue', 'event', 'membership',
    'partner', 'patient_type', 'provider_role', 'private_link'
  )),
  context_key text,
  provider_role text,
  patient_type text,
  membership_key text,
  days_of_week smallint[] not null default '{}',
  local_start_time time,
  local_end_time time,
  require_inventory boolean not null default false,
  conditions jsonb not null default '{}'::jsonb,
  priority integer not null default 100 check (priority between 0 and 10000),
  status text not null default 'active' check (status in ('draft', 'active', 'inactive', 'archived')),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  reason text not null check (char_length(trim(reason)) between 2 and 1000),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from),
  check (local_end_time is null or local_start_time is not null),
  unique (tenant_id, offering_id, rule_key),
  foreign key (tenant_id, offering_id)
    references public.catalog_offerings(tenant_id, id) on delete cascade
);

create index if not exists catalog_availability_resolution_idx
  on public.catalog_availability_rules
  (tenant_id, offering_id, status, audience, priority desc, effective_from desc);

-- --------------------------------------------------------------------------
-- Relationships, not duplicate products
-- --------------------------------------------------------------------------

create table if not exists public.catalog_addon_relations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parent_offering_id uuid not null,
  addon_offering_id uuid not null,
  allowed boolean not null default true,
  max_quantity integer not null default 1 check (max_quantity between 1 and 100),
  additional_duration_minutes integer not null default 0 check (additional_duration_minutes between 0 and 1440),
  role_restrictions text[] not null default '{}',
  compatibility_rules jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  reason text not null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_offering_id <> addon_offering_id),
  unique (tenant_id, parent_offering_id, addon_offering_id),
  foreign key (tenant_id, parent_offering_id)
    references public.catalog_offerings(tenant_id, id) on delete cascade,
  foreign key (tenant_id, addon_offering_id)
    references public.catalog_offerings(tenant_id, id) on delete restrict
);

create table if not exists public.catalog_package_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  package_offering_id uuid not null,
  component_offering_id uuid not null,
  quantity numeric(10,3) not null default 1 check (quantity > 0),
  display_order integer not null default 0,
  fulfillment_instructions text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (package_offering_id <> component_offering_id),
  unique (tenant_id, package_offering_id, component_offering_id),
  foreign key (tenant_id, package_offering_id)
    references public.catalog_offerings(tenant_id, id) on delete cascade,
  foreign key (tenant_id, component_offering_id)
    references public.catalog_offerings(tenant_id, id) on delete restrict
);

-- Inventory IDs are references into an authoritative inventory source.  The
-- polymorphic text ID intentionally supports both the current legacy `items`
-- store and Avalon OS `os_inventory_items` without copying either table.
create table if not exists public.catalog_inventory_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  offering_id uuid not null,
  inventory_source text not null check (inventory_source in ('legacy_item', 'os_inventory_item', 'external')),
  inventory_item_id text not null,
  inventory_item_name text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit text not null default 'unit',
  is_optional boolean not null default false,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, offering_id, inventory_source, inventory_item_id),
  foreign key (tenant_id, offering_id)
    references public.catalog_offerings(tenant_id, id) on delete cascade
);

-- Generic context menu rows cover event menus, membership inclusions, partner
-- menus, and private links while always pointing back to the same Offering.
create table if not exists public.catalog_context_offerings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  offering_id uuid not null,
  context_type text not null check (context_type in ('event', 'membership', 'partner', 'private_link', 'location')),
  context_key text not null,
  enabled boolean not null default true,
  display_name_override text,
  description_override text,
  quantity_limit integer check (quantity_limit is null or quantity_limit >= 0),
  price_rule_id uuid,
  display_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, context_type, context_key, offering_id),
  foreign key (tenant_id, offering_id)
    references public.catalog_offerings(tenant_id, id) on delete cascade,
  foreign key (tenant_id, offering_id, price_rule_id)
    references public.catalog_prices(tenant_id, offering_id, id) on delete restrict
);

create table if not exists public.catalog_compensation_refs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  offering_id uuid not null,
  rule_type text not null check (rule_type in ('flat', 'percentage', 'event', 'shift', 'none', 'external_reference')),
  rule_reference text,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, offering_id, rule_type, rule_reference),
  foreign key (tenant_id, offering_id)
    references public.catalog_offerings(tenant_id, id) on delete cascade
);

-- Aliases map legacy cart/protocol/dose/Acuity/detail-path identifiers to the
-- same stable Offering.  Namespace + key is unique per tenant, preventing one
-- operational identifier from ambiguously resolving to two Offerings.
create table if not exists public.catalog_aliases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  offering_id uuid not null,
  namespace text not null check (namespace ~ '^[a-z0-9_]+$'),
  alias_key text not null check (char_length(trim(alias_key)) between 1 and 300),
  source text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, namespace, alias_key),
  foreign key (tenant_id, offering_id)
    references public.catalog_offerings(tenant_id, id) on delete cascade
);

-- --------------------------------------------------------------------------
-- Governance, import cutover, and immutable audit
-- --------------------------------------------------------------------------

create table if not exists public.catalog_change_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  action text not null,
  risk_type text not null check (risk_type in ('pricing', 'clinical', 'activation', 'visibility', 'availability', 'other')),
  object_type text not null default 'offering',
  object_id text,
  requested_change jsonb not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'applied', 'cancelled')),
  requested_by_profile_id uuid references public.profiles(id) on delete set null,
  requested_by_agent text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requested_by_profile_id is not null or requested_by_agent is not null),
  check (requested_by_agent is null or status <> 'applied' or reviewed_by is not null)
);

create table if not exists public.catalog_import_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  source_name text not null,
  source_version text not null,
  idempotency_key text not null,
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  catalog_hash text,
  status text not null default 'running' check (status in ('running', 'verifying', 'succeeded', 'failed')),
  source_count integer not null default 0 check (source_count >= 0),
  catalog_count integer not null default 0 check (catalog_count >= 0),
  exact_match boolean not null default false,
  shadow_verified boolean not null default false,
  cutover_ready boolean not null default false,
  source_manifest jsonb not null default '{}'::jsonb,
  reconciliation jsonb not null default '{}'::jsonb,
  error_code text,
  error_detail text,
  attempt_count integer not null default 1 check (attempt_count > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz,
  unique (tenant_id, idempotency_key),
  unique (tenant_id, source_name, source_hash),
  unique (tenant_id, id)
);

create index if not exists catalog_import_readiness_idx
  on public.catalog_import_runs (tenant_id, created_at desc, status, cutover_ready);

create table if not exists public.catalog_audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  actor_type text not null default 'system' check (actor_type in ('user', 'agent', 'system', 'import')),
  actor_label text,
  action text not null,
  object_type text not null,
  object_id text,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  source text not null default 'database',
  request_id text,
  created_at timestamptz not null default now()
);

create index if not exists catalog_audit_lookup_idx
  on public.catalog_audit_log (tenant_id, object_type, object_id, created_at desc);

-- --------------------------------------------------------------------------
-- Versioning, activation gates, and append-only history
-- --------------------------------------------------------------------------

create or replace function public.catalog_touch_version()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;

create or replace function public.catalog_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.catalog_assert_offering_complete(p_tenant_id uuid, p_offering_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_offering public.catalog_offerings%rowtype;
  v_audience text;
begin
  select * into v_offering from public.catalog_offerings
   where tenant_id = p_tenant_id and id = p_offering_id;
  if not found or v_offering.status <> 'active' then
    return;
  end if;

  if v_offering.category_id is null or not exists (
    select 1 from public.catalog_categories category
     where category.tenant_id = v_offering.tenant_id
       and category.id = v_offering.category_id
       and category.status = 'active'
  ) then
    raise exception using errcode = '23514', message = 'catalog_activation_missing_category';
  end if;

  if v_offering.offering_type = 'package' and not exists (
    select 1 from public.catalog_package_items item
     where item.tenant_id = v_offering.tenant_id and item.package_offering_id = v_offering.id
  ) then
    raise exception using errcode = '23514', message = 'catalog_activation_incomplete_package';
  end if;

  for v_audience in
    select rule.audience
      from public.catalog_visibility_rules rule
     where rule.tenant_id = v_offering.tenant_id
       and rule.offering_id = v_offering.id
       and rule.enabled = true
       and rule.effective_from <= now()
       and (rule.effective_to is null or rule.effective_to > now())
  loop
    if not exists (
      select 1 from public.catalog_presentations p
       where p.tenant_id = v_offering.tenant_id
         and p.offering_id = v_offering.id
         and p.audience = v_audience
         and p.enabled = true
    ) then
      raise exception using errcode = '23514', message = 'catalog_activation_missing_presentation:' || v_audience;
    end if;

    if v_audience in ('client', 'public') and not exists (
      select 1 from public.catalog_presentations p
       where p.tenant_id = v_offering.tenant_id
         and p.offering_id = v_offering.id
         and p.audience = v_audience
         and p.enabled = true
         and char_length(trim(p.display_name)) > 0
         and p.detail_path ~ '^/products/[a-z0-9-]+/[a-z0-9-]+/?$'
         and (
           p.booking_path ~ '^/book([/?#].*)?$'
           or p.booking_path ~ '^/products/[a-z0-9-]+/[a-z0-9-]+/?$'
         )
    ) then
      raise exception using errcode = '23514', message = 'catalog_activation_invalid_client_paths:' || v_audience;
    end if;

    -- Admin and BD are internal record audiences, not sellable availability
    -- surfaces. They need a presentation but no commerce availability rule.
    if v_audience not in ('admin', 'bd') then
      if not exists (
        select 1 from public.catalog_availability_rules a
         where a.tenant_id = v_offering.tenant_id
           and a.offering_id = v_offering.id
           and a.status = 'active'
           and a.effect = 'allow'
           and (a.audience is null or a.audience = v_audience)
           and a.effective_from <= now()
           and (a.effective_to is null or a.effective_to > now())
      ) then
        raise exception using errcode = '23514', message = 'catalog_activation_missing_availability:' || v_audience;
      end if;
    end if;

    if v_audience in ('nurse', 'np', 'physician') and (
      coalesce(v_offering.estimated_duration_minutes, 0) <= 0
      or not exists (
        select 1 from public.catalog_presentations p
         where p.tenant_id = v_offering.tenant_id
           and p.offering_id = v_offering.id
           and p.audience = v_audience
           and char_length(trim(coalesce(p.nurse_instructions, ''))) > 0
      )
    ) then
      raise exception using errcode = '23514', message = 'catalog_activation_missing_approved_fulfillment:' || v_audience;
    end if;

    if v_audience in ('client', 'public', 'event', 'membership', 'partner', 'private_link')
      and not exists (
        select 1 from public.catalog_prices price
         where price.tenant_id = v_offering.tenant_id
           and price.offering_id = v_offering.id
           and price.status in ('active', 'scheduled')
           and price.amount_cents > 0
           and price.currency = 'USD'
           and price.effective_from <= now()
           and (price.effective_to is null or price.effective_to > now())
           and case
             when v_audience in ('client', 'public')
               then price.price_type = 'standard' and price.conditions = '{}'::jsonb
             when v_audience = 'event'
               then price.price_type in ('event', 'contract', 'corporate', 'standard')
             when v_audience = 'membership'
               then price.price_type in ('member', 'contract', 'standard')
             when v_audience = 'partner'
               then price.price_type in ('partner', 'contract', 'standard')
             else price.price_type in ('custom', 'contract', 'standard')
           end
      ) then
      raise exception using errcode = '23514', message = 'catalog_activation_missing_positive_price:' || v_audience;
    end if;
  end loop;
  return;
end;
$$;

create or replace function public.catalog_guard_offering_complete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.catalog_assert_offering_complete(new.tenant_id, new.id);
  return new;
end;
$$;

create or replace function public.catalog_guard_dependent_complete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old_tenant uuid;
  v_old_offering uuid;
  v_new_tenant uuid;
  v_new_offering uuid;
begin
  if tg_op <> 'INSERT' then
    v_old_tenant := old.tenant_id;
    v_old_offering := case
      when tg_table_name = 'catalog_package_items' then old.package_offering_id
      else old.offering_id
    end;
  end if;
  if tg_op <> 'DELETE' then
    v_new_tenant := new.tenant_id;
    v_new_offering := case
      when tg_table_name = 'catalog_package_items' then new.package_offering_id
      else new.offering_id
    end;
  end if;
  if v_old_tenant is not null and v_old_offering is not null then
    perform public.catalog_assert_offering_complete(v_old_tenant, v_old_offering);
  end if;
  if v_new_tenant is not null and v_new_offering is not null
    and (v_new_tenant, v_new_offering) is distinct from (v_old_tenant, v_old_offering) then
    perform public.catalog_assert_offering_complete(v_new_tenant, v_new_offering);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.catalog_guard_category_complete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row record;
  v_tenant_id uuid;
  v_category_id uuid;
begin
  if tg_op = 'DELETE' then
    v_tenant_id := old.tenant_id;
    v_category_id := old.id;
  else
    v_tenant_id := new.tenant_id;
    v_category_id := new.id;
  end if;
  for v_row in
    select tenant_id, id from public.catalog_offerings
     where tenant_id = v_tenant_id
       and category_id = v_category_id
       and status = 'active'
  loop
    perform public.catalog_assert_offering_complete(v_row.tenant_id, v_row.id);
  end loop;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_catalog_offerings_guard_activation on public.catalog_offerings;
create trigger trg_catalog_offerings_guard_activation
after insert or update on public.catalog_offerings
for each row execute function public.catalog_guard_offering_complete();

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'catalog_presentations', 'catalog_prices', 'catalog_visibility_rules',
    'catalog_availability_rules', 'catalog_package_items'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || tbl || '_completeness', tbl);
    execute format(
      'create constraint trigger %I after insert or update or delete on public.%I deferrable initially deferred for each row execute function public.catalog_guard_dependent_complete()',
      'trg_' || tbl || '_completeness', tbl
    );
  end loop;
end $$;

drop trigger if exists trg_catalog_categories_completeness on public.catalog_categories;
create constraint trigger trg_catalog_categories_completeness
after update or delete on public.catalog_categories
deferrable initially deferred
for each row execute function public.catalog_guard_category_complete();

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'catalog_categories', 'catalog_offerings', 'catalog_presentations', 'catalog_prices'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || tbl || '_version', tbl);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.catalog_touch_version()',
      'trg_' || tbl || '_version', tbl
    );
  end loop;

  foreach tbl in array array[
    'catalog_visibility_rules', 'catalog_availability_rules', 'catalog_addon_relations',
    'catalog_inventory_requirements', 'catalog_context_offerings', 'catalog_compensation_refs',
    'catalog_change_requests', 'catalog_import_runs'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || tbl || '_updated', tbl);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.catalog_touch_updated_at()',
      'trg_' || tbl || '_updated', tbl
    );
  end loop;
end $$;

create or replace function public.catalog_write_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_actor uuid;
begin
  begin
    v_actor := nullif(coalesce(v_new->>'updated_by', v_new->>'created_by', v_old->>'updated_by', v_old->>'created_by'), '')::uuid;
  exception when others then
    v_actor := null;
  end;

  insert into public.catalog_audit_log (
    tenant_id, actor_profile_id, actor_type, action, object_type, object_id,
    previous_value, new_value, reason, source
  ) values (
    (v_row->>'tenant_id')::uuid,
    v_actor,
    case
      when coalesce(v_row->>'requested_by_agent', '') <> '' then 'agent'
      when coalesce(v_row->>'imported_source', '') <> '' then 'import'
      when v_actor is not null then 'user'
      else 'system'
    end,
    lower(tg_op),
    tg_table_name,
    coalesce(v_row->>'stable_key', v_row->>'id'),
    v_old,
    v_new,
    coalesce(v_new->>'reason', v_old->>'reason'),
    'database_trigger'
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'catalog_categories', 'catalog_offerings', 'catalog_presentations', 'catalog_prices',
    'catalog_visibility_rules', 'catalog_availability_rules', 'catalog_addon_relations',
    'catalog_package_items', 'catalog_inventory_requirements', 'catalog_context_offerings',
    'catalog_compensation_refs', 'catalog_aliases', 'catalog_change_requests',
    'catalog_import_runs'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'trg_' || tbl || '_audit', tbl);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.catalog_write_audit()',
      'trg_' || tbl || '_audit', tbl
    );
  end loop;
end $$;

create or replace function public.catalog_forbid_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception using errcode = '42501', message = 'catalog_audit_is_append_only';
end;
$$;

drop trigger if exists trg_catalog_audit_append_only on public.catalog_audit_log;
create trigger trg_catalog_audit_append_only
before update or delete on public.catalog_audit_log
for each row execute function public.catalog_forbid_audit_mutation();

-- --------------------------------------------------------------------------
-- Atomic admin save (composite DTO -> master + presentation + price + rules)
-- --------------------------------------------------------------------------

create or replace function public.catalog_admin_save_offering(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_offering jsonb,
  p_expected_version integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_key text;
  v_category_id uuid;
  v_existing public.catalog_offerings%rowtype;
  v_requested_status text := coalesce(nullif(p_offering->>'status', ''), 'draft');
  v_visibility jsonb := coalesce(p_offering->'visibility', '{}'::jsonb);
  v_audience text;
  v_visible boolean;
  v_price bigint;
  v_result public.catalog_offerings%rowtype;
  v_is_existing boolean := false;
  v_availability_mode text;
  v_presentation jsonb;
begin
  if p_tenant_id is null or p_actor_id is null then
    raise exception using errcode = '22023', message = 'catalog_tenant_and_actor_required';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 2 then
    raise exception using errcode = '22023', message = 'catalog_change_reason_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':avalon-catalog-import', 0));
  if exists (
    select 1 from public.catalog_import_runs run
     where run.tenant_id = p_tenant_id and run.status in ('running', 'verifying')
  ) then
    raise exception using errcode = '55000', message = 'catalog_import_in_progress';
  end if;

  v_key := lower(regexp_replace(coalesce(
    nullif(p_offering->>'stable_key', ''),
    nullif(p_offering->>'id', ''),
    nullif(p_offering->>'sku', ''),
    nullif(p_offering->>'internal_name', ''),
    nullif(p_offering->>'public_name', '')
  ), '[^a-zA-Z0-9]+', '-', 'g'));
  v_key := trim(both '-' from v_key);
  if v_key = '' or v_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'catalog_invalid_stable_key';
  end if;

  select * into v_existing
    from public.catalog_offerings
   where tenant_id = p_tenant_id and stable_key = v_key
   for update;

  v_is_existing := found;

  if v_is_existing and p_expected_version is null then
    raise exception using errcode = '40001', message = 'catalog_version_conflict';
  end if;
  if v_is_existing and p_expected_version is not null and v_existing.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'catalog_version_conflict';
  end if;

  if nullif(p_offering->>'category_id', '') is not null then
    select id into v_category_id from public.catalog_categories
     where tenant_id = p_tenant_id and id = (p_offering->>'category_id')::uuid;
    if v_category_id is null then
      raise exception using errcode = '22023', message = 'catalog_valid_category_required';
    end if;
  elsif nullif(p_offering->>'category_key', '') is not null then
    select id into v_category_id from public.catalog_categories
     where tenant_id = p_tenant_id and stable_key = p_offering->>'category_key';
    if v_category_id is null then
      raise exception using errcode = '22023', message = 'catalog_valid_category_required';
    end if;
  elsif v_is_existing then
    v_category_id := v_existing.category_id;
  end if;
  -- Uncategorized private drafts are valid working records. Activation remains
  -- impossible until the completeness gate sees an active category.
  if v_category_id is null and v_requested_status = 'active' then
    raise exception using errcode = '22023', message = 'catalog_valid_category_required';
  end if;

  v_availability_mode := nullif(p_offering->>'availability_mode', '');
  if not v_is_existing and v_availability_mode is null then
    v_availability_mode := 'closed';
  end if;
  if v_availability_mode is not null and v_availability_mode not in ('global', 'closed') then
    raise exception using errcode = '22023', message = 'catalog_invalid_availability_mode';
  end if;

  -- Keep the row non-active until every dependent record is in place.  The
  -- transaction commits only after the activation gate passes.
  insert into public.catalog_offerings (
    tenant_id, stable_key, sku, internal_name, public_name, short_name,
    offering_type, category_id, status, description, short_description,
    internal_description, tags, estimated_duration_minutes, display_order,
    featured, taxability, discount_eligible, clinical_metadata,
    fulfillment_metadata, financial_metadata, created_by, updated_by
  ) values (
    p_tenant_id, v_key, nullif(p_offering->>'sku', ''),
    coalesce(nullif(p_offering->>'internal_name', ''), nullif(p_offering->>'public_name', ''), v_key),
    coalesce(nullif(p_offering->>'public_name', ''), nullif(p_offering->>'internal_name', ''), v_key),
    nullif(p_offering->>'short_name', ''),
    coalesce(nullif(p_offering->>'type', ''), nullif(p_offering->>'offering_type', ''), 'other'),
    v_category_id, 'draft', p_offering->>'description', p_offering->>'short_description',
    p_offering->>'internal_description',
    coalesce(array(select jsonb_array_elements_text(coalesce(p_offering->'tags', '[]'::jsonb))), '{}'),
    nullif(p_offering->>'estimated_duration_minutes', '')::integer,
    coalesce((p_offering->>'display_order')::integer, 0),
    coalesce((p_offering->>'featured')::boolean, false),
    coalesce(nullif(p_offering->>'taxability', ''), 'non_taxable'),
    coalesce((p_offering->>'discount_eligible')::boolean, true),
    coalesce(p_offering->'clinical_metadata', '{}'::jsonb),
    coalesce(p_offering->'fulfillment_metadata', '{}'::jsonb),
    jsonb_strip_nulls(coalesce(p_offering->'financial_metadata', '{}'::jsonb) || jsonb_build_object(
      'internal_cost_cents', nullif(p_offering->>'internal_cost_cents', '')::bigint,
      'target_margin_percent', nullif(p_offering->>'target_margin_percent', '')::numeric
    )),
    p_actor_id, p_actor_id
  )
  on conflict (tenant_id, stable_key) do update set
    sku = excluded.sku,
    internal_name = excluded.internal_name,
    public_name = excluded.public_name,
    short_name = excluded.short_name,
    offering_type = excluded.offering_type,
    category_id = excluded.category_id,
    description = excluded.description,
    short_description = excluded.short_description,
    internal_description = excluded.internal_description,
    tags = excluded.tags,
    estimated_duration_minutes = excluded.estimated_duration_minutes,
    display_order = excluded.display_order,
    featured = excluded.featured,
    taxability = excluded.taxability,
    discount_eligible = excluded.discount_eligible,
    clinical_metadata = excluded.clinical_metadata,
    fulfillment_metadata = excluded.fulfillment_metadata,
    financial_metadata = excluded.financial_metadata,
    status = 'draft',
    updated_by = p_actor_id
  returning id into v_id;

  foreach v_audience in array array['client','nurse','np','physician','admin','event','membership','partner','public','private_link','bd']
  loop
    v_presentation := coalesce(p_offering->'presentations'->v_audience, '{}'::jsonb);
    v_visible := case
      when v_audience = 'admin' then true
      else coalesce((v_visibility->>v_audience)::boolean, false)
    end;

    insert into public.catalog_presentations (
      tenant_id, offering_id, audience, enabled, display_name, description,
      short_description, nurse_instructions, admin_notes, benefits, use_cases,
      included_items, hero_url, thumbnail_url, icon, detail_path, booking_path,
      display_order, featured, metadata, created_by, updated_by
    ) values (
      p_tenant_id, v_id, v_audience, v_visible,
      coalesce(v_presentation->>'display_name', nullif(p_offering->>'public_name', ''), nullif(p_offering->>'internal_name', ''), v_key),
      case
        when v_audience = 'client' and p_offering ? 'client_description' then p_offering->>'client_description'
        when v_presentation ? 'description' then v_presentation->>'description'
        else p_offering->>'description'
      end,
      case
        when v_audience = 'client' and p_offering ? 'short_description' then p_offering->>'short_description'
        when v_presentation ? 'short_description' then v_presentation->>'short_description'
        else p_offering->>'short_description'
      end,
      case
        when v_audience = 'nurse' and p_offering ? 'nurse_instructions' then p_offering->>'nurse_instructions'
        when v_presentation ? 'nurse_instructions' then v_presentation->>'nurse_instructions'
        else null
      end,
      case
        when v_audience = 'admin' and p_offering ? 'admin_notes' then p_offering->>'admin_notes'
        when v_presentation ? 'admin_notes' then v_presentation->>'admin_notes'
        else null
      end,
      coalesce(array(select jsonb_array_elements_text(
        case when v_audience = 'client' and p_offering ? 'benefits'
          then coalesce(p_offering->'benefits', '[]'::jsonb)
          else coalesce(v_presentation->'benefits', p_offering->'benefits', '[]'::jsonb) end
      )), '{}'),
      coalesce(array(select jsonb_array_elements_text(
        case when v_audience = 'client' and p_offering ? 'use_cases'
          then coalesce(p_offering->'use_cases', '[]'::jsonb)
          else coalesce(v_presentation->'use_cases', p_offering->'use_cases', '[]'::jsonb) end
      )), '{}'),
      coalesce(array(select jsonb_array_elements_text(
        case when v_audience = 'client' and p_offering ? 'included_items'
          then coalesce(p_offering->'included_items', '[]'::jsonb)
          else coalesce(v_presentation->'included_items', p_offering->'included_items', '[]'::jsonb) end
      )), '{}'),
      case when v_audience = 'client' and p_offering ? 'hero_url' then p_offering->>'hero_url' else v_presentation->>'hero_url' end,
      case when v_audience = 'client' and p_offering ? 'thumbnail_url' then p_offering->>'thumbnail_url' else v_presentation->>'thumbnail_url' end,
      case when v_audience = 'client' and p_offering ? 'icon' then p_offering->>'icon' else v_presentation->>'icon' end,
      case when v_audience = 'client' and p_offering ? 'detail_path' then p_offering->>'detail_path' else v_presentation->>'detail_path' end,
      case when v_audience = 'client' and p_offering ? 'booking_path' then p_offering->>'booking_path' else v_presentation->>'booking_path' end,
      case when v_audience = 'client' and p_offering ? 'display_order'
        then coalesce((p_offering->>'display_order')::integer, 0)
        else coalesce((v_presentation->>'display_order')::integer, (p_offering->>'display_order')::integer, 0) end,
      case when v_audience = 'client' and p_offering ? 'featured'
        then coalesce((p_offering->>'featured')::boolean, false)
        else coalesce((v_presentation->>'featured')::boolean, (p_offering->>'featured')::boolean, false) end,
      coalesce(v_presentation->'metadata', '{}'::jsonb), p_actor_id, p_actor_id
    ) on conflict (tenant_id, offering_id, audience) do update set
      enabled = excluded.enabled,
      display_name = excluded.display_name,
      description = excluded.description,
      short_description = excluded.short_description,
      nurse_instructions = excluded.nurse_instructions,
      admin_notes = excluded.admin_notes,
      benefits = excluded.benefits,
      use_cases = excluded.use_cases,
      included_items = excluded.included_items,
      hero_url = excluded.hero_url,
      thumbnail_url = excluded.thumbnail_url,
      icon = excluded.icon,
      detail_path = excluded.detail_path,
      booking_path = excluded.booking_path,
      display_order = excluded.display_order,
      featured = excluded.featured,
      metadata = excluded.metadata,
      updated_by = p_actor_id;

    insert into public.catalog_visibility_rules (
      tenant_id, offering_id, audience, enabled, reason, created_by, updated_by
    ) values (p_tenant_id, v_id, v_audience, v_visible, p_reason, p_actor_id, p_actor_id)
    on conflict (tenant_id, offering_id, audience) do update set
      enabled = excluded.enabled,
      effective_from = now(),
      effective_to = null,
      reason = excluded.reason,
      updated_by = p_actor_id;

    if v_visible and v_availability_mode = 'global' and v_audience not in ('admin', 'bd') then
      insert into public.catalog_availability_rules (
        tenant_id, offering_id, rule_key, effect, audience, context_type,
        priority, status, reason, created_by, updated_by
      ) values (
        p_tenant_id, v_id, 'global-' || v_audience, 'allow', v_audience,
        'global', 100, 'active', p_reason, p_actor_id, p_actor_id
      ) on conflict (tenant_id, offering_id, rule_key) do update set
        effect = 'allow', status = 'active', effective_from = now(),
        effective_to = null, reason = excluded.reason, updated_by = p_actor_id;
    end if;
  end loop;

  if v_availability_mode = 'closed' then
    update public.catalog_availability_rules rule
       set status = 'inactive', effective_to = now(), reason = p_reason, updated_by = p_actor_id
     where rule.tenant_id = p_tenant_id
       and rule.offering_id = v_id
       and rule.effect = 'allow'
       and rule.status = 'active';
  end if;

  if nullif(p_offering->>'base_price_cents', '') is not null then
    v_price := (p_offering->>'base_price_cents')::bigint;
    insert into public.catalog_prices (
      tenant_id, offering_id, rule_key, price_type, amount_cents,
      compare_at_cents, minimum_allowed_cents, currency, priority, status,
      effective_from, reason, created_by, updated_by
    ) values (
      p_tenant_id, v_id, 'standard-current', 'standard', v_price,
      nullif(p_offering->>'compare_at_price_cents', '')::bigint,
      nullif(p_offering->>'minimum_allowed_price_cents', '')::bigint,
      coalesce(nullif(p_offering->>'currency', ''), 'USD'), 100, 'active',
      now(), p_reason, p_actor_id, p_actor_id
    ) on conflict (tenant_id, offering_id, rule_key) do update set
      amount_cents = excluded.amount_cents,
      compare_at_cents = excluded.compare_at_cents,
      minimum_allowed_cents = excluded.minimum_allowed_cents,
      currency = excluded.currency,
      status = 'active',
      effective_from = now(),
      effective_to = null,
      reason = excluded.reason,
      updated_by = p_actor_id;
  end if;

  update public.catalog_offerings
     set status = v_requested_status,
         archived_at = case when v_requested_status = 'archived' then now() else null end,
         updated_by = p_actor_id
   where tenant_id = p_tenant_id and id = v_id
  returning * into v_result;

  insert into public.catalog_audit_log (
    tenant_id, actor_profile_id, actor_type, action, object_type, object_id,
    previous_value, new_value, reason, source
  ) values (
    p_tenant_id, p_actor_id, 'user',
    case when v_is_existing then 'update_offering' else 'create_offering' end,
    'catalog_offerings', v_result.stable_key,
    case when v_is_existing then to_jsonb(v_existing) else null end,
    to_jsonb(v_result), p_reason, 'catalog_admin_save_offering'
  );

  return jsonb_build_object(
    'id', v_result.id,
    'stable_key', v_result.stable_key,
    'version', v_result.version,
    'status', v_result.status
  );
end;
$$;

-- Current and future price changes share one auditable atomic function.
create or replace function public.catalog_change_price(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_stable_key text,
  p_amount_cents bigint,
  p_price_type text,
  p_effective_from timestamptz,
  p_conditions jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_offering_id uuid;
  v_rule_key text;
  v_effective timestamptz := coalesce(p_effective_from, now());
  v_status text := case when v_effective > now() then 'scheduled' else 'active' end;
  v_priority integer;
  v_id uuid;
  v_offering_version integer;
  v_price_type text := lower(trim(coalesce(p_price_type, 'standard')));
  v_conditions jsonb := coalesce(p_conditions, '{}'::jsonb);
  v_scope_key text;
begin
  if p_actor_id is null or char_length(trim(coalesce(p_reason, ''))) < 2 then
    raise exception using errcode = '22023', message = 'catalog_price_actor_and_reason_required';
  end if;
  if p_amount_cents is null or p_amount_cents < 0 then
    raise exception using errcode = '22023', message = 'catalog_invalid_price';
  end if;
  if v_price_type not in ('standard', 'member', 'event', 'corporate', 'partner', 'location', 'promotional', 'contract', 'custom')
     or jsonb_typeof(v_conditions) <> 'object' then
    raise exception using errcode = '22023', message = 'catalog_invalid_price_conditions';
  end if;
  if v_price_type = 'standard' then
    if v_conditions <> '{}'::jsonb then
      raise exception using errcode = '22023', message = 'catalog_standard_price_must_be_unconditional';
    end if;
  else
    v_scope_key := case v_price_type
      when 'event' then 'event_key'
      when 'corporate' then 'corporate_key'
      when 'member' then 'membership_key'
      when 'location' then 'location_key'
      when 'partner' then 'partner_key'
      when 'promotional' then 'promotion_key'
      when 'contract' then 'contract_key'
      when 'custom' then 'custom_key'
    end;
    if not (v_conditions ? v_scope_key)
       or v_conditions - v_scope_key <> '{}'::jsonb
       or jsonb_typeof(v_conditions->v_scope_key) not in ('string', 'number')
       or trim(coalesce(v_conditions->>v_scope_key, '')) = '' then
      raise exception using errcode = '22023', message = 'catalog_contextual_price_scope_required';
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':avalon-catalog-import', 0));
  if exists (
    select 1 from public.catalog_import_runs run
     where run.tenant_id = p_tenant_id and run.status in ('running', 'verifying')
  ) then
    raise exception using errcode = '55000', message = 'catalog_import_in_progress';
  end if;
  select id into v_offering_id from public.catalog_offerings
   where tenant_id = p_tenant_id and stable_key = p_stable_key and status <> 'archived'
   for update;
  if v_offering_id is null then
    raise exception using errcode = 'P0002', message = 'catalog_offering_not_found';
  end if;
  if p_amount_cents = 0 and exists (
    select 1 from public.catalog_visibility_rules visibility
     where visibility.tenant_id = p_tenant_id
       and visibility.offering_id = v_offering_id
       and visibility.enabled = true
       and visibility.audience in ('client', 'public', 'event', 'membership', 'partner', 'private_link')
       and visibility.effective_from <= now()
       and (visibility.effective_to is null or visibility.effective_to > now())
  ) then
    raise exception using errcode = '23514', message = 'catalog_external_price_must_be_positive';
  end if;
  if v_price_type = 'standard'
    and v_conditions <> '{}'::jsonb
    and exists (
      select 1 from public.catalog_visibility_rules visibility
       where visibility.tenant_id = p_tenant_id
         and visibility.offering_id = v_offering_id
         and visibility.enabled = true
         and visibility.audience in ('client', 'public')
    ) then
    raise exception using errcode = '23514', message = 'catalog_public_standard_price_must_be_unconditional';
  end if;

  v_priority := case v_price_type
    when 'contract' then 1000 when 'event' then 900 when 'corporate' then 850
    when 'member' then 800 when 'location' then 700 when 'partner' then 650
    when 'promotional' then 600 when 'custom' then 500 else 100 end;
  v_rule_key := v_price_type || '-' || to_char(v_effective at time zone 'UTC', 'YYYYMMDDHH24MISSMS');

  update public.catalog_prices
     set effective_to = v_effective,
         status = case when v_effective <= now() then 'superseded' else status end,
         updated_by = p_actor_id,
         reason = p_reason
   where tenant_id = p_tenant_id
     and offering_id = v_offering_id
     and price_type = v_price_type
     and conditions = v_conditions
     and status in ('active', 'scheduled')
     and (effective_to is null or effective_to > v_effective)
     and effective_from < v_effective;

  insert into public.catalog_prices (
    tenant_id, offering_id, rule_key, price_type, amount_cents, priority,
    conditions, status, effective_from, reason, created_by, updated_by
  ) values (
    p_tenant_id, v_offering_id, v_rule_key, v_price_type, p_amount_cents,
    v_priority, v_conditions, v_status, v_effective,
    p_reason, p_actor_id, p_actor_id
  ) returning id into v_id;

  -- Price is part of the Offering's optimistic-concurrency aggregate. Bump the
  -- master revision so a stale editor cannot overwrite a newer price while
  -- saving an unrelated field.
  update public.catalog_offerings
     set updated_by = p_actor_id
   where tenant_id = p_tenant_id and id = v_offering_id
  returning version into v_offering_version;

  return jsonb_build_object(
    'id', v_id, 'rule_key', v_rule_key, 'status', v_status,
    'effective_from', v_effective, 'offering_version', v_offering_version
  );
end;
$$;

-- --------------------------------------------------------------------------
-- Atomic legacy public-menu import.  It stops in VERIFYING; the server then
-- performs an independent projection comparison and explicitly finalizes it.
-- The newest non-succeeded run makes all public reads fail closed.
-- --------------------------------------------------------------------------

create or replace function public.catalog_apply_legacy_import(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_source_name text,
  p_source_version text,
  p_idempotency_key text,
  p_source_hash text,
  p_categories jsonb,
  p_offerings jsonb,
  p_aliases jsonb,
  p_reconciliation jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.catalog_import_runs%rowtype;
  v_category jsonb;
  v_row jsonb;
  v_alias jsonb;
  v_category_id uuid;
  v_offering_id uuid;
  v_audience text;
  v_count integer;
  v_addon_key text;
  v_has_existing_run boolean := false;
  v_visible boolean;
begin
  if p_tenant_id is null or p_actor_id is null then
    raise exception using errcode = '22023', message = 'catalog_import_tenant_and_actor_required';
  end if;
  if jsonb_typeof(p_categories) <> 'array' or jsonb_typeof(p_offerings) <> 'array' or jsonb_typeof(p_aliases) <> 'array' then
    raise exception using errcode = '22023', message = 'catalog_import_arrays_required';
  end if;
  if p_source_name = 'legacy_products_by_category' and jsonb_array_length(p_offerings) <> 37 then
    raise exception using errcode = '22023', message = 'catalog_public_source_must_contain_37_offerings';
  end if;

  -- One import per tenant at a time; transaction-scoped lock releases on exit.
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':avalon-catalog-import', 0));

  -- Recover a prior server crash between APPLY and FINALIZE. A newer source
  -- hash explicitly supersedes an unfinished run under the same tenant lock;
  -- the stale verifier can no longer finalize after this transition.
  update public.catalog_import_runs stale
     set status = 'failed', cutover_ready = false, exact_match = false,
         shadow_verified = false, error_code = 'superseded_incomplete_import',
         error_detail = 'A newer legacy source hash superseded an unfinished import',
         verified_at = now(), updated_at = now()
   where stale.tenant_id = p_tenant_id
     and stale.source_name = p_source_name
     and stale.source_hash <> p_source_hash
     and stale.status in ('running', 'verifying');

  select * into v_run from public.catalog_import_runs
   where tenant_id = p_tenant_id and source_name = p_source_name and source_hash = p_source_hash
   for update;
  v_has_existing_run := found;
  if v_has_existing_run and v_run.status = 'succeeded' and v_run.cutover_ready then
    return jsonb_build_object('run_id', v_run.id, 'status', v_run.status, 'idempotent', true);
  end if;

  -- The legacy importer is a one-time bootstrap, not an ongoing synchronizer.
  -- After a verified cutover, operators edit the governed Catalog directly so
  -- a changed legacy file can never erase human clinical/fulfillment work.
  if exists (
    select 1 from public.catalog_import_runs prior
     where prior.tenant_id = p_tenant_id
       and prior.source_name = p_source_name
       and prior.status = 'succeeded'
       and prior.cutover_ready = true
  ) then
    raise exception using errcode = '55000', message = 'catalog_legacy_import_locked_after_cutover';
  end if;

  -- Invalidate every prior cutover before changing shared canonical rows.
  update public.catalog_import_runs
     set cutover_ready = false, updated_at = now()
   where tenant_id = p_tenant_id and cutover_ready = true;

  if v_has_existing_run then
    update public.catalog_import_runs set
      status = 'running', source_version = p_source_version,
      idempotency_key = p_idempotency_key, source_count = jsonb_array_length(p_offerings),
      source_manifest = jsonb_build_object('categories', p_categories, 'offerings', p_offerings, 'aliases', p_aliases),
      reconciliation = coalesce(p_reconciliation, '{}'::jsonb),
      catalog_hash = null, catalog_count = 0, exact_match = false,
      shadow_verified = false, cutover_ready = false, error_code = null,
      error_detail = null, attempt_count = attempt_count + 1, created_by = p_actor_id,
      updated_at = now(), verified_at = null
    where id = v_run.id returning * into v_run;
  else
    insert into public.catalog_import_runs (
      tenant_id, source_name, source_version, idempotency_key, source_hash,
      status, source_count, source_manifest, reconciliation, created_by
    ) values (
      p_tenant_id, p_source_name, p_source_version, p_idempotency_key,
      p_source_hash, 'running', jsonb_array_length(p_offerings),
      jsonb_build_object('categories', p_categories, 'offerings', p_offerings, 'aliases', p_aliases),
      coalesce(p_reconciliation, '{}'::jsonb), p_actor_id
    ) returning * into v_run;
  end if;

  for v_category in select value from jsonb_array_elements(p_categories)
  loop
    insert into public.catalog_categories (
      tenant_id, stable_key, name, description, display_order, status,
      audience_visibility, created_by, updated_by
    ) values (
      p_tenant_id, v_category->>'stable_key', v_category->>'name',
      v_category->>'description', coalesce((v_category->>'display_order')::integer, 0),
      'active', array['client','nurse','admin','public'], p_actor_id, p_actor_id
    ) on conflict (tenant_id, stable_key) do update set
      name = excluded.name, description = excluded.description,
      display_order = excluded.display_order, status = 'active',
      audience_visibility = excluded.audience_visibility, updated_by = p_actor_id;
  end loop;

  -- Upsert every canonical Offering as draft, build its projections/rules, then
  -- activate only after all dependencies exist.  The whole function is one DB
  -- transaction, so a validation error cannot publish a partial menu.
  for v_row in select value from jsonb_array_elements(p_offerings)
  loop
    select id into v_category_id from public.catalog_categories
     where tenant_id = p_tenant_id and stable_key = v_row->>'category_key';
    if v_category_id is null then
      raise exception using errcode = '23514', message = 'catalog_import_unknown_category:' || coalesce(v_row->>'category_key', 'null');
    end if;

    insert into public.catalog_offerings (
      tenant_id, stable_key, sku, internal_name, public_name, short_name,
      offering_type, category_id, status, description, short_description,
      tags, estimated_duration_minutes, display_order, featured,
      clinical_metadata, fulfillment_metadata, financial_metadata,
      imported_source, imported_key, created_by, updated_by
    ) values (
      p_tenant_id, v_row->>'stable_key', v_row->>'sku', v_row->>'internal_name',
      v_row->>'public_name', v_row->>'short_name', v_row->>'offering_type',
      v_category_id, 'draft', v_row->>'description', v_row->>'short_description',
      coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'tags', '[]'::jsonb))), '{}'),
      nullif(v_row->>'estimated_duration_minutes', '')::integer,
      coalesce((v_row->>'display_order')::integer, 0),
      coalesce((v_row->>'featured')::boolean, false),
      jsonb_strip_nulls(jsonb_build_object(
        'treatment_type', v_row->>'treatment_type',
        'protocol_reference', v_row->>'protocol_reference',
        'requires_clinical_review', coalesce((v_row->>'requires_clinical_review')::boolean, true)
      )),
      jsonb_build_object('required_supplies', coalesce(v_row->'required_supplies', '[]'::jsonb)),
      '{}'::jsonb, p_source_name, v_row->>'stable_key', p_actor_id, p_actor_id
    ) on conflict (tenant_id, stable_key) do update set
      sku = excluded.sku, internal_name = excluded.internal_name,
      public_name = excluded.public_name, short_name = excluded.short_name,
      offering_type = excluded.offering_type, category_id = excluded.category_id,
      status = 'draft', description = excluded.description,
      short_description = excluded.short_description, tags = excluded.tags,
      estimated_duration_minutes = excluded.estimated_duration_minutes,
      display_order = excluded.display_order, featured = excluded.featured,
      clinical_metadata = excluded.clinical_metadata,
      fulfillment_metadata = excluded.fulfillment_metadata,
      imported_source = excluded.imported_source, imported_key = excluded.imported_key,
      archived_at = null, updated_by = p_actor_id
    returning id into v_offering_id;

    foreach v_audience in array array['client','public','nurse','admin']
    loop
      v_visible := case
        when v_audience = 'nurse' then coalesce((v_row->>'nurse_ready')::boolean, false)
        else true
      end;
      insert into public.catalog_presentations (
        tenant_id, offering_id, audience, enabled, display_name, description,
        short_description, nurse_instructions, benefits, use_cases,
        included_items, hero_url, thumbnail_url, detail_path, booking_path,
        display_order, featured, metadata, created_by, updated_by
      ) values (
        p_tenant_id, v_offering_id, v_audience, v_visible, v_row->>'public_name',
        v_row->>'description', v_row->>'short_description',
        case when v_audience in ('nurse','admin') then v_row->>'nurse_instructions' else null end,
        coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'benefits', '[]'::jsonb))), '{}'),
        coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'use_cases', '[]'::jsonb))), '{}'),
        coalesce(array(select jsonb_array_elements_text(coalesce(v_row->'included_items', '[]'::jsonb))), '{}'),
        v_row->>'hero_url', v_row->>'thumbnail_url', v_row->>'detail_path',
        v_row->>'booking_path', coalesce((v_row->>'display_order')::integer, 0),
        coalesce((v_row->>'featured')::boolean, false),
        jsonb_build_object('source_category_key', v_row->>'category_key'),
        p_actor_id, p_actor_id
      ) on conflict (tenant_id, offering_id, audience) do update set
        enabled = excluded.enabled, display_name = excluded.display_name,
        description = excluded.description, short_description = excluded.short_description,
        nurse_instructions = excluded.nurse_instructions, benefits = excluded.benefits,
        use_cases = excluded.use_cases, included_items = excluded.included_items,
        hero_url = excluded.hero_url, thumbnail_url = excluded.thumbnail_url,
        detail_path = excluded.detail_path, booking_path = excluded.booking_path,
        display_order = excluded.display_order, featured = excluded.featured,
        metadata = excluded.metadata, updated_by = p_actor_id;

      insert into public.catalog_visibility_rules (
        tenant_id, offering_id, audience, enabled, reason, created_by, updated_by
      ) values (
        p_tenant_id, v_offering_id, v_audience, v_visible,
        'Exact import from current public productsByCategory', p_actor_id, p_actor_id
      ) on conflict (tenant_id, offering_id, audience) do update set
        enabled = excluded.enabled, effective_from = now(), effective_to = null,
        reason = excluded.reason, updated_by = p_actor_id;

      if v_visible and v_audience not in ('admin', 'bd') then
        insert into public.catalog_availability_rules (
          tenant_id, offering_id, rule_key, effect, audience, context_type,
          priority, status, reason, created_by, updated_by
        ) values (
          p_tenant_id, v_offering_id, 'legacy-global-' || v_audience, 'allow',
          v_audience, 'global', 100, 'active',
          'Explicit global allow copied from current public availability', p_actor_id, p_actor_id
        ) on conflict (tenant_id, offering_id, rule_key) do update set
          effect = 'allow', audience = excluded.audience, context_type = 'global',
          status = 'active', effective_from = now(), effective_to = null,
          reason = excluded.reason, updated_by = p_actor_id;
      else
        update public.catalog_availability_rules rule set
          status = 'inactive', effective_to = now(), updated_by = p_actor_id,
          reason = 'Audience remains closed until dedicated approved fulfillment data exists'
        where rule.tenant_id = p_tenant_id
          and rule.offering_id = v_offering_id
          and rule.rule_key = 'legacy-global-' || v_audience
          and rule.status = 'active';
      end if;
    end loop;

    insert into public.catalog_prices (
      tenant_id, offering_id, rule_key, price_type, amount_cents,
      compare_at_cents, currency, priority, status, effective_from, reason,
      created_by, updated_by
    ) values (
      p_tenant_id, v_offering_id, 'legacy-standard', 'standard',
      (v_row->>'price_cents')::bigint,
      nullif(v_row->>'compare_at_price_cents', '')::bigint,
      coalesce(nullif(v_row->>'currency', ''), 'USD'), 100, 'active',
      now(), 'Exact price copied from current public productsByCategory',
      p_actor_id, p_actor_id
    ) on conflict (tenant_id, offering_id, rule_key) do update set
      amount_cents = excluded.amount_cents,
      compare_at_cents = excluded.compare_at_cents,
      currency = excluded.currency, priority = 100, status = 'active',
      effective_from = now(), effective_to = null, reason = excluded.reason,
      updated_by = p_actor_id;

    -- Relational compatibility: current treatments allow the currently
    -- published add-on/shot Offerings.  Resolve after all rows are loaded.
  end loop;

  -- Remove stale imported public rows from every live surface.  Records remain
  -- archived for audit and any historic booking references.
  update public.catalog_offerings offering
     set status = 'archived', archived_at = now(), updated_by = p_actor_id
   where offering.tenant_id = p_tenant_id
     and offering.imported_source = p_source_name
     and not exists (
       select 1 from jsonb_array_elements(p_offerings) expected
        where expected->>'stable_key' = offering.stable_key
     );

  update public.catalog_visibility_rules visibility
     set enabled = false, reason = 'Archived because it is absent from the current public source', updated_by = p_actor_id
   where visibility.tenant_id = p_tenant_id
     and exists (
       select 1 from public.catalog_offerings offering
        where offering.tenant_id = visibility.tenant_id
          and offering.id = visibility.offering_id
          and offering.imported_source = p_source_name
          and offering.status = 'archived'
     );

  -- Aliases must resolve exactly once.  Upsert cannot silently move an alias
  -- between Offerings: a conflict pointing elsewhere aborts the transaction.
  for v_alias in select value from jsonb_array_elements(p_aliases)
  loop
    select id into v_offering_id from public.catalog_offerings
     where tenant_id = p_tenant_id and stable_key = v_alias->>'offering_key';
    if v_offering_id is null then
      raise exception using errcode = '23514', message = 'catalog_alias_unknown_offering:' || coalesce(v_alias->>'offering_key', 'null');
    end if;
    if exists (
      select 1 from public.catalog_aliases a
       where a.tenant_id = p_tenant_id
         and a.namespace = v_alias->>'namespace'
         and a.alias_key = v_alias->>'alias_key'
         and a.offering_id <> v_offering_id
    ) then
      raise exception using errcode = '23505', message = 'catalog_alias_conflict:' || (v_alias->>'namespace') || ':' || (v_alias->>'alias_key');
    end if;
    insert into public.catalog_aliases (
      tenant_id, offering_id, namespace, alias_key, source, created_by
    ) values (
      p_tenant_id, v_offering_id, v_alias->>'namespace',
      v_alias->>'alias_key', v_alias->>'source', p_actor_id
    ) on conflict (tenant_id, namespace, alias_key) do nothing;
  end loop;

  -- Replace imported add-on relations from stable keys only after every
  -- canonical Offering exists.  Missing keys abort instead of being skipped.
  delete from public.catalog_addon_relations relation
   where relation.tenant_id = p_tenant_id
     and exists (
       select 1 from public.catalog_offerings parent
        where parent.tenant_id = relation.tenant_id
          and parent.id = relation.parent_offering_id
          and parent.imported_source = p_source_name
     );

  for v_row in select value from jsonb_array_elements(p_offerings)
  loop
    select id into v_offering_id from public.catalog_offerings
     where tenant_id = p_tenant_id and stable_key = v_row->>'stable_key';
    for v_addon_key in select jsonb_array_elements_text(coalesce(v_row->'allowed_addon_keys', '[]'::jsonb))
    loop
      if not exists (
        select 1 from public.catalog_offerings addon
         where addon.tenant_id = p_tenant_id and addon.stable_key = v_addon_key
           and addon.offering_type in ('add_on', 'im_injection')
      ) then
        raise exception using errcode = '23514', message = 'catalog_addon_relation_unresolved:' || v_addon_key;
      end if;
      insert into public.catalog_addon_relations (
        tenant_id, parent_offering_id, addon_offering_id, allowed,
        max_quantity, reason, created_by, updated_by
      ) select
        p_tenant_id, v_offering_id, addon.id, true, 1,
        'Compatibility imported from the current public menu', p_actor_id, p_actor_id
      from public.catalog_offerings addon
      where addon.tenant_id = p_tenant_id and addon.stable_key = v_addon_key;
    end loop;
  end loop;

  -- Activate last so the DB completeness gate evaluates the final graph.
  update public.catalog_offerings offering
     set status = 'active', archived_at = null, updated_by = p_actor_id
   where offering.tenant_id = p_tenant_id
     and offering.imported_source = p_source_name
     and exists (
       select 1 from jsonb_array_elements(p_offerings) expected
        where expected->>'stable_key' = offering.stable_key
     );

  select count(*) into v_count from public.catalog_offerings offering
   where offering.tenant_id = p_tenant_id
     and offering.imported_source = p_source_name
     and offering.status = 'active';
  if v_count <> jsonb_array_length(p_offerings) then
    raise exception using errcode = '23514', message = 'catalog_import_count_mismatch';
  end if;

  update public.catalog_import_runs set
    status = 'verifying', catalog_count = v_count, exact_match = false,
    shadow_verified = false, cutover_ready = false, updated_at = now()
  where id = v_run.id;

  return jsonb_build_object('run_id', v_run.id, 'status', 'verifying', 'catalog_count', v_count, 'idempotent', false);
exception when others then
  -- The exception rolls back all writes in this RPC, including the run row.
  -- The server records a sanitized failed run separately when it catches the
  -- error; no partial Catalog graph can commit.
  raise;
end;
$$;

create or replace function public.catalog_finalize_import(
  p_tenant_id uuid,
  p_actor_id uuid,
  p_run_id uuid,
  p_catalog_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.catalog_import_runs%rowtype;
  v_expected jsonb;
  v_mismatches integer;
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':avalon-catalog-import', 0));
  select * into v_run from public.catalog_import_runs
   where tenant_id = p_tenant_id and id = p_run_id for update;
  if not found or v_run.status <> 'verifying' then
    raise exception using errcode = '22023', message = 'catalog_import_not_verifying';
  end if;

  -- Exact DB shadow comparison against the stored source manifest.  These are
  -- the fields rendered by the current public menu; extras cannot be hidden by
  -- a matching count.
  select count(*) into v_mismatches
    from jsonb_array_elements(v_run.source_manifest->'offerings') expected
    left join public.catalog_offerings offering
      on offering.tenant_id = p_tenant_id
     and offering.stable_key = expected->>'stable_key'
     and offering.status = 'active'
    left join public.catalog_categories category
      on category.tenant_id = offering.tenant_id and category.id = offering.category_id
    left join public.catalog_presentations presentation
      on presentation.tenant_id = offering.tenant_id
     and presentation.offering_id = offering.id
     and presentation.audience = 'client' and presentation.enabled = true
    left join public.catalog_prices price
      on price.tenant_id = offering.tenant_id
     and price.offering_id = offering.id
     and price.rule_key = 'legacy-standard' and price.status = 'active'
   where offering.id is null
      or category.stable_key is distinct from expected->>'category_key'
      or category.name is distinct from expected->>'category_name'
      or category.description is distinct from expected->>'category_description'
      or category.display_order is distinct from (expected->>'category_display_order')::integer
      or offering.public_name is distinct from expected->>'public_name'
      or offering.short_name is distinct from expected->>'short_name'
      or offering.offering_type is distinct from expected->>'offering_type'
      or offering.description is distinct from expected->>'description'
      or offering.short_description is distinct from expected->>'short_description'
      or offering.estimated_duration_minutes is distinct from nullif(expected->>'estimated_duration_minutes', '')::integer
      or offering.display_order is distinct from (expected->>'display_order')::integer
      or offering.featured is distinct from coalesce((expected->>'featured')::boolean, false)
      or presentation.display_name is distinct from expected->>'public_name'
      or presentation.description is distinct from expected->>'description'
      or presentation.short_description is distinct from expected->>'short_description'
      or to_jsonb(presentation.benefits) is distinct from coalesce(expected->'benefits', '[]'::jsonb)
      or to_jsonb(presentation.included_items) is distinct from coalesce(expected->'included_items', '[]'::jsonb)
      or presentation.thumbnail_url is distinct from expected->>'thumbnail_url'
      or presentation.hero_url is distinct from expected->>'hero_url'
      or presentation.detail_path is distinct from expected->>'detail_path'
      or presentation.booking_path is distinct from expected->>'booking_path'
      or price.amount_cents is distinct from (expected->>'price_cents')::bigint
      or price.currency is distinct from expected->>'currency'
      or price.compare_at_cents is distinct from nullif(expected->>'compare_at_price_cents', '')::bigint
      or not exists (
        select 1 from public.catalog_visibility_rules visibility
         where visibility.tenant_id = offering.tenant_id
           and visibility.offering_id = offering.id
           and visibility.audience = 'client' and visibility.enabled = true
      )
      or not exists (
        select 1 from public.catalog_visibility_rules visibility
         where visibility.tenant_id = offering.tenant_id
           and visibility.offering_id = offering.id
           and visibility.audience = 'public' and visibility.enabled = true
      )
      or not exists (
        select 1 from public.catalog_availability_rules availability
         where availability.tenant_id = offering.tenant_id
           and availability.offering_id = offering.id
           and availability.audience = 'client'
           and availability.effect = 'allow' and availability.status = 'active'
      )
      or (
        select coalesce(jsonb_agg(addon.stable_key order by addon.stable_key), '[]'::jsonb)
          from public.catalog_addon_relations relation
          join public.catalog_offerings addon
            on addon.tenant_id = relation.tenant_id and addon.id = relation.addon_offering_id
         where relation.tenant_id = offering.tenant_id
           and relation.parent_offering_id = offering.id
           and relation.allowed = true
      ) is distinct from (
        select coalesce(jsonb_agg(value order by value), '[]'::jsonb)
          from jsonb_array_elements_text(coalesce(expected->'allowed_addon_keys', '[]'::jsonb)) alias(value)
      );

  select count(*) into v_count from public.catalog_offerings offering
   where offering.tenant_id = p_tenant_id
     and offering.imported_source = v_run.source_name
     and offering.status = 'active';

  if v_mismatches <> 0 or v_count <> v_run.source_count or p_catalog_hash <> v_run.source_hash then
    update public.catalog_import_runs set
      status = 'failed', catalog_hash = p_catalog_hash, catalog_count = v_count,
      exact_match = false, shadow_verified = false, cutover_ready = false,
      error_code = 'shadow_mismatch', error_detail = 'Independent public projection did not exactly match the stored source manifest',
      verified_at = now(), updated_at = now()
    where id = v_run.id;
    return jsonb_build_object('run_id', v_run.id, 'status', 'failed', 'mismatches', v_mismatches, 'catalog_count', v_count);
  end if;

  update public.catalog_import_runs set
    status = 'succeeded', catalog_hash = p_catalog_hash, catalog_count = v_count,
    exact_match = true, shadow_verified = true, cutover_ready = true,
    error_code = null, error_detail = null, verified_at = now(), updated_at = now()
  where id = v_run.id;

  insert into public.catalog_audit_log (
    tenant_id, actor_profile_id, actor_type, action, object_type, object_id,
    new_value, reason, source
  ) values (
    p_tenant_id, p_actor_id, 'import', 'legacy_import_shadow_verified',
    'catalog_import_runs', v_run.id::text,
    jsonb_build_object('source_count', v_run.source_count, 'catalog_count', v_count, 'source_hash', v_run.source_hash),
    'Exact productsByCategory shadow comparison passed', 'catalog_finalize_import'
  );

  return jsonb_build_object('run_id', v_run.id, 'status', 'succeeded', 'exact_match', true, 'catalog_count', v_count);
end;
$$;

-- One statement and one MVCC snapshot for readiness plus every projected row.
-- Public/nurse reads must never combine a prior cutover proof with a newer
-- graph that is still being imported or edited.
create or replace function public.catalog_read_graph(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'tenantId', p_tenant_id,
    'categories', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.display_order, r.stable_key)
      from public.catalog_categories r where r.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'offerings', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.display_order, r.stable_key)
      from public.catalog_offerings r where r.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'presentations', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.offering_id, r.audience)
      from public.catalog_presentations r where r.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'prices', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.offering_id, r.priority desc, r.effective_from desc)
      from public.catalog_prices r where r.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'visibility', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.offering_id, r.audience)
      from public.catalog_visibility_rules r where r.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'availability', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.offering_id, r.priority desc, r.rule_key)
      from public.catalog_availability_rules r where r.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'addonRelations', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.parent_offering_id, r.addon_offering_id)
      from public.catalog_addon_relations r where r.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'packageItems', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.package_offering_id, r.display_order, r.component_offering_id)
      from public.catalog_package_items r where r.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'inventoryRequirements', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.offering_id, r.inventory_source, r.inventory_item_id)
      from public.catalog_inventory_requirements r where r.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'contextOfferings', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.context_type, r.context_key, r.display_order, r.offering_id)
      from public.catalog_context_offerings r where r.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'compensationRefs', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.offering_id, r.rule_type)
      from public.catalog_compensation_refs r where r.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'aliases', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.namespace, r.alias_key)
      from public.catalog_aliases r where r.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'importRuns', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at desc)
      from public.catalog_import_runs r where r.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'audits', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at desc)
      from (
        select * from public.catalog_audit_log
        where tenant_id = p_tenant_id order by created_at desc limit 200
      ) r
    ), '[]'::jsonb)
  );
$$;

-- --------------------------------------------------------------------------
-- Service-only security boundary
-- --------------------------------------------------------------------------

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'catalog_categories', 'catalog_offerings', 'catalog_presentations', 'catalog_prices',
    'catalog_visibility_rules', 'catalog_availability_rules', 'catalog_addon_relations',
    'catalog_package_items', 'catalog_inventory_requirements', 'catalog_context_offerings',
    'catalog_compensation_refs', 'catalog_aliases', 'catalog_change_requests',
    'catalog_import_runs', 'catalog_audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all on table public.%I from public, anon, authenticated', tbl);
    execute format('grant select, insert, update, delete on table public.%I to service_role', tbl);
  end loop;
end $$;

revoke all on function public.catalog_admin_save_offering(uuid, uuid, jsonb, integer, text) from public, anon, authenticated;
revoke all on function public.catalog_change_price(uuid, uuid, text, bigint, text, timestamptz, jsonb, text) from public, anon, authenticated;
revoke all on function public.catalog_apply_legacy_import(uuid, uuid, text, text, text, text, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.catalog_finalize_import(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.catalog_read_graph(uuid) from public, anon, authenticated;
revoke all on function public.catalog_touch_version() from public, anon, authenticated;
revoke all on function public.catalog_touch_updated_at() from public, anon, authenticated;
revoke all on function public.catalog_assert_offering_complete(uuid, uuid) from public, anon, authenticated;
revoke all on function public.catalog_guard_offering_complete() from public, anon, authenticated;
revoke all on function public.catalog_guard_dependent_complete() from public, anon, authenticated;
revoke all on function public.catalog_guard_category_complete() from public, anon, authenticated;
revoke all on function public.catalog_write_audit() from public, anon, authenticated;
revoke all on function public.catalog_forbid_audit_mutation() from public, anon, authenticated;
grant execute on function public.catalog_admin_save_offering(uuid, uuid, jsonb, integer, text) to service_role;
grant execute on function public.catalog_change_price(uuid, uuid, text, bigint, text, timestamptz, jsonb, text) to service_role;
grant execute on function public.catalog_apply_legacy_import(uuid, uuid, text, text, text, text, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.catalog_finalize_import(uuid, uuid, uuid, text) to service_role;
grant execute on function public.catalog_read_graph(uuid) to service_role;
grant execute on function public.catalog_touch_version() to service_role;
grant execute on function public.catalog_touch_updated_at() to service_role;
grant execute on function public.catalog_assert_offering_complete(uuid, uuid) to service_role;
grant execute on function public.catalog_guard_offering_complete() to service_role;
grant execute on function public.catalog_guard_dependent_complete() to service_role;
grant execute on function public.catalog_guard_category_complete() to service_role;
grant execute on function public.catalog_write_audit() to service_role;
grant execute on function public.catalog_forbid_audit_mutation() to service_role;

comment on table public.catalog_offerings is 'Canonical tenant-scoped Avalon Offering. One record renders into every audience/context.';
comment on table public.catalog_inventory_requirements is 'Consumption mapping only; stock remains authoritative in the referenced Inventory source.';
comment on table public.catalog_import_runs is 'Fail-closed import and exact shadow-verification gate for Catalog cutover.';
comment on table public.catalog_audit_log is 'Append-only field-level Catalog history generated for every database mutation.';
