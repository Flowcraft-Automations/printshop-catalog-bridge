-- =============================================================
-- mdvd catalog — database schema snapshot
-- Generated from the live Supabase project on 2026-10-06.
-- Covers: public tables, constraints, RLS policies, functions,
-- triggers and the app_role enum. Data is NOT included.
-- =============================================================

create extension if not exists pgcrypto;

-- ---------- Enum ----------

create type public.app_role as enum ('admin', 'moderator', 'user');

-- ---------- Tables ----------

create table public.app_config (
  id       integer not null default 1 primary key,
  password text
);

create table public.business_config (
  id              integer not null default 1 primary key,
  monthly_cost    numeric not null default 0,
  monthly_revenue numeric not null default 0,
  overhead_factor numeric not null default 1.3,
  updated_at      timestamptz not null default now()
);

create table public.families (
  family                text primary key,
  items_count           integer,
  notes                 text,
  cost_per_m2           numeric not null default 0,
  outsource_cost_per_m2 numeric,
  outsource_width_cm    numeric,
  outsource_height_cm   numeric,
  pricing_config        jsonb not null default '{}'::jsonb
);

create table public.products (
  id               uuid not null default gen_random_uuid() primary key,
  row_key          text not null unique,
  name             text not null,
  family           text not null references public.families(family) on update cascade,
  width_cm         numeric,
  height_cm        numeric,
  qty              integer not null default 1,
  source           text not null default 'manual',
  site_exists      boolean not null default false,
  site_status      text not null default 'unknown',
  site_url         text,
  site_price       numeric,
  site_category    text,
  senzey_exists    boolean not null default false,
  senzey_status    text not null default 'unknown',
  senzey_price     numeric,
  senzey_ids       text,
  senzey_group     text,
  senzey_dup_count integer not null default 0,
  competitor_price numeric,
  competitor_ref   text,
  proposed_price   numeric,
  final_price      numeric,
  verified         boolean not null default false,
  verified_at      timestamptz,
  is_anchor        boolean not null default false,
  anomaly          text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.product_history (
  id         uuid not null default gen_random_uuid() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  field      text not null,
  old_value  text,
  new_value  text,
  batch_id   uuid,
  source     text not null default 'manual',
  changed_at timestamptz not null default now()
);

create table public.product_notes (
  id         uuid not null default gen_random_uuid() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  body       text not null,
  author     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.user_roles (
  id         uuid not null default gen_random_uuid() primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create table public.user_family_access (
  id         uuid not null default gen_random_uuid() primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  family     text not null references public.families(family) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, family)
);

-- ---------- Grants ----------

grant select on public.app_config to anon, authenticated;
grant insert, update, delete on public.app_config to authenticated;
grant select, insert, update, delete on public.business_config to authenticated;
grant select, insert, update, delete on public.families to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.product_history to authenticated;
grant select, insert, update, delete on public.product_notes to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;
grant select, insert, update, delete on public.user_family_access to authenticated;
grant all on all tables in schema public to service_role;

-- ---------- Row Level Security ----------

alter table public.app_config enable row level security;
alter table public.business_config enable row level security;
alter table public.families enable row level security;
alter table public.products enable row level security;
alter table public.product_history enable row level security;
alter table public.product_notes enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_family_access enable row level security;

-- ---------- Functions ----------

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

create or replace function public.has_family_access(_family text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.is_admin() or exists (
    select 1 from public.user_family_access
    where user_id = auth.uid() and family = _family
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', new.email))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user'::public.app_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

-- ---------- Triggers ----------

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger set_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create trigger set_product_notes_updated_at
  before update on public.product_notes
  for each row execute function public.set_updated_at();

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_business_config_updated_at
  before update on public.business_config
  for each row execute function public.set_updated_at();

-- ---------- Policies ----------

-- app_config: password gate readable by anyone, writable by admins
create policy app_config_select on public.app_config
  for select to anon, authenticated using (true);
create policy app_config_write on public.app_config
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- business_config
create policy business_config_select on public.business_config
  for select to authenticated using (true);
create policy business_config_write on public.business_config
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- families: visible/editable to users with access, fully managed by admins
create policy families_select on public.families
  for select to authenticated using (public.has_family_access(family));
create policy families_update_by_access on public.families
  for update to authenticated
  using (public.has_family_access(family)) with check (public.has_family_access(family));
create policy families_write on public.families
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- products: scoped by family access, delete admin-only
create policy products_select on public.products
  for select to authenticated using (public.has_family_access(family));
create policy products_insert on public.products
  for insert to authenticated with check (public.has_family_access(family));
create policy products_update on public.products
  for update to authenticated
  using (public.has_family_access(family)) with check (public.has_family_access(family));
create policy products_delete on public.products
  for delete to authenticated using (public.is_admin());

-- product_history
create policy product_history_select on public.product_history
  for select to authenticated using (
    exists (select 1 from public.products p
            where p.id = product_history.product_id and public.has_family_access(p.family)));
create policy product_history_insert on public.product_history
  for insert to authenticated with check (
    exists (select 1 from public.products p
            where p.id = product_history.product_id and public.has_family_access(p.family)));
create policy product_history_delete on public.product_history
  for delete to authenticated using (public.is_admin());

-- product_notes
create policy product_notes_select on public.product_notes
  for select to authenticated using (
    exists (select 1 from public.products p
            where p.id = product_notes.product_id and public.has_family_access(p.family)));
create policy product_notes_insert on public.product_notes
  for insert to authenticated with check (
    exists (select 1 from public.products p
            where p.id = product_notes.product_id and public.has_family_access(p.family)));
create policy product_notes_update on public.product_notes
  for update to authenticated using (
    exists (select 1 from public.products p
            where p.id = product_notes.product_id and public.has_family_access(p.family)));
create policy product_notes_delete on public.product_notes
  for delete to authenticated using (
    exists (select 1 from public.products p
            where p.id = product_notes.product_id and public.has_family_access(p.family)));

-- profiles: own row, admins see all
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- user_roles: own row, admins manage all
create policy user_roles_select on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy user_roles_write on public.user_roles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- user_family_access: own rows, admins manage all
create policy user_family_access_select on public.user_family_access
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy user_family_access_write on public.user_family_access
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
