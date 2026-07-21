-- 032_gift_cards.sql
-- Gift cards: customer purchases via Stripe checkout → unguessable code emailed
-- to the recipient → recipient redeems on their member account → grants visit
-- credit via member_credit_ledger (source='gift_card_redemption', already in
-- the extended CHECK from migration 029). Idempotent.

create table if not exists public.gift_cards (
  id                       uuid primary key default gen_random_uuid(),
  code                     text not null unique,
  amount_cents             integer not null check (amount_cents > 0),
  currency                 text not null default 'usd',
  recipient_email          text,
  recipient_name           text,
  sender_email             text,
  sender_name              text,
  sender_message           text,
  stripe_session_id        text unique,
  status                   text not null default 'pending'
                            check (status in ('pending', 'issued', 'redeemed', 'voided')),
  issued_at                timestamptz,
  redeemed_at              timestamptz,
  redeemed_by_profile_id   uuid references public.profiles(id) on delete set null,
  created_at               timestamptz not null default now()
);

create index if not exists gift_cards_status_idx on public.gift_cards (status);
create index if not exists gift_cards_recipient_email_idx on public.gift_cards (recipient_email);

alter table public.gift_cards enable row level security;
grant select, insert, update, delete on public.gift_cards to service_role;
