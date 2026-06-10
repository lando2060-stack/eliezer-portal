-- ============================================================
-- פורטל סוכנים — אליעזר נכסים
-- ============================================================

-- ── Profiles (extends auth.users) ────────────────────────────
create table if not exists profiles (
  id         uuid primary key references auth.users on delete cascade,
  full_name  text not null default '',
  phone      text not null default '',
  role       text not null default 'agent' check (role in ('admin', 'agent')),
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'agent')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── Agents ───────────────────────────────────────────────────
create table if not exists agents (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  name               text not null default '',
  email              text not null default '',
  phone              text not null default '',
  commission_percent numeric not null default 50,
  is_active          boolean not null default true,
  notes              text not null default '',
  user_id            text not null default ''
);

-- permissions column for per-agent granular access control
alter table agents add column if not exists permissions jsonb not null default '{}'::jsonb;

-- ── Categories ───────────────────────────────────────────────
create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null default '',
  color      text not null default '#6366f1',
  is_default boolean not null default false
);

-- ── Deals ────────────────────────────────────────────────────
create table if not exists deals (
  id                       uuid primary key default gen_random_uuid(),
  created_at               timestamptz not null default now(),
  month                    text not null default '',
  day_of_month             int not null default 1,
  area                     text not null default '',
  agent_id                 text not null default '',
  agent_name               text not null default '',
  client_name              text not null default '',
  side                     text not null default '',
  address                  text not null default '',
  deal_amount              numeric not null default 0,
  vat_included             boolean not null default true,
  commission_amount        numeric not null default 0,
  collection_percent       numeric not null default 100,
  collected_actual         numeric not null default 0,
  payment_method           text not null default '',
  agent_commission_percent numeric not null default 50,
  agent_commission         numeric not null default 0,
  office_commission        numeric not null default 0,
  paid_to_agent            numeric not null default 0,
  has_invoice              boolean not null default false,
  lead_source              text not null default '',
  origin                   text not null default '',
  lawyer_name              text not null default '',
  cooperation_agent        text not null default '',
  post_deal_procedure      text not null default '',
  notes                    text not null default '',
  status                   text not null default 'פתוחה'
);

-- created_date alias (used by the app for sorting/display)
alter table deals add column if not exists created_date timestamptz;
create or replace function sync_deals_created_date()
returns trigger language plpgsql as $$
begin new.created_date := new.created_at; return new; end; $$;
drop trigger if exists sync_created_date on deals;
create trigger sync_created_date before insert or update on deals
  for each row execute procedure sync_deals_created_date();

-- ── Expenses ─────────────────────────────────────────────────
create table if not exists expenses (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  created_by_id     text not null default '',
  vendor_name       text not null default '',
  vendor_tax_id     text not null default '',
  date              date,
  total_amount      numeric not null default 0,
  amount_before_vat numeric not null default 0,
  vat_amount        numeric not null default 0,
  category          text not null default '',
  payment_method    text not null default '',
  receipt_number    text not null default '',
  invoice_number    text not null default '',
  currency          text not null default 'ILS',
  notes             text not null default '',
  has_receipt       boolean not null default false,
  status            text not null default 'pending_approval',
  receipt_url       text not null default '',
  scope             text not null default 'agent',
  agent_id          text not null default '',
  agent_name        text not null default '',
  deal_id           text not null default '',
  document_type     text not null default 'receipt',
  is_anomaly        boolean not null default false
);

-- ── Vendors ──────────────────────────────────────────────────
create table if not exists vendors (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  name              text not null default '',
  tax_id            text not null default '',
  default_category  text not null default '',
  receipt_count     int not null default 0,
  total_expenses    numeric not null default 0,
  last_expense_date date,
  address           text not null default '',
  phone             text not null default '',
  average_amount    numeric not null default 0
);

-- ── Payments ─────────────────────────────────────────────────
create table if not exists payments (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  deal_id           text not null default '',
  deal_client_name  text not null default '',
  deal_address      text not null default '',
  payer_name        text not null default '',
  payer_type        text not null default '',
  amount            numeric not null default 0,
  date              date,
  payment_method    text not null default '',
  destination       text not null default '',
  agent_id          text not null default '',
  agent_name        text not null default '',
  notes             text not null default '',
  commission_rate   numeric not null default 2,
  commission_amount numeric not null default 0
);

-- ── Recurring Expenses ───────────────────────────────────────
create table if not exists recurring_expenses (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  name           text not null default '',
  vendor_name    text not null default '',
  amount         numeric not null default 0,
  category       text not null default '',
  payment_method text not null default '',
  day_of_month   int not null default 1,
  is_active      boolean not null default true
);

-- ── Activity Logs ────────────────────────────────────────────
create table if not exists activity_logs (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  created_date timestamptz not null default now(),
  action       text not null default '',
  entity_type  text not null default '',
  entity_id    text not null default '',
  description  text not null default '',
  user_name    text not null default '',
  user_id      text not null default ''
);

-- ── Documents ────────────────────────────────────────────────
create table if not exists documents (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  created_date timestamptz not null default now(),
  name         text not null default '',
  type         text not null default 'other',
  vendor_name  text not null default '',
  notes        text not null default '',
  file_url     text not null default ''
);

-- ── Clients ──────────────────────────────────────────────────
create table if not exists clients (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  name          text not null default '',
  contact_email text not null default '',
  phone         text not null default ''
);

-- ── Projects ─────────────────────────────────────────────────
create table if not exists projects (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null default '',
  client     text not null default '',
  status     text not null default 'active'
);

-- ── Row Level Security ────────────────────────────────────────
alter table profiles          enable row level security;
alter table agents             enable row level security;
alter table categories         enable row level security;
alter table deals              enable row level security;
alter table expenses           enable row level security;
alter table vendors            enable row level security;
alter table payments           enable row level security;
alter table recurring_expenses enable row level security;
alter table activity_logs      enable row level security;
alter table documents          enable row level security;
alter table clients            enable row level security;
alter table projects           enable row level security;

create policy "authenticated_full_access" on profiles          for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on agents            for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on categories        for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on deals             for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on expenses          for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on vendors           for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on payments          for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on recurring_expenses for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on activity_logs     for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on documents         for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on clients           for all to authenticated using (true) with check (true);
create policy "authenticated_full_access" on projects          for all to authenticated using (true) with check (true);
