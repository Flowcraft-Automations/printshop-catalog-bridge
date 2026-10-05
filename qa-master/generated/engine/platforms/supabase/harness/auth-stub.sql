create schema if not exists auth;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
-- The columns Supabase's own auth.users carries, all of them. A migration that
-- seeds a user writes instance_id, aud, role, encrypted_password and the token
-- columns, so a stub with fewer columns fails it, and with it every migration
-- that comes after. A build that ignores those errors then reports success over
-- a database with tables missing.
create table if not exists auth.users (
  id                          uuid primary key default gen_random_uuid(),
  instance_id                 uuid,
  aud                         varchar(255),
  role                        varchar(255),
  email                       varchar(255),
  encrypted_password          varchar(255),
  email_confirmed_at          timestamptz,
  invited_at                  timestamptz,
  confirmation_token          varchar(255),
  confirmation_sent_at        timestamptz,
  recovery_token              varchar(255),
  recovery_sent_at            timestamptz,
  email_change_token_new      varchar(255),
  email_change                varchar(255),
  email_change_sent_at        timestamptz,
  last_sign_in_at             timestamptz,
  raw_app_meta_data           jsonb,
  raw_user_meta_data          jsonb,
  is_super_admin              boolean,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now(),
  phone                       text,
  phone_confirmed_at          timestamptz,
  email_change_token_current  varchar(255) default '',
  email_change_confirm_status smallint default 0,
  banned_until                timestamptz,
  reauthentication_token      varchar(255) default '',
  reauthentication_sent_at    timestamptz,
  is_sso_user                 boolean default false,
  deleted_at                  timestamptz,
  is_anonymous                boolean default false);

-- Supabase installs pgcrypto into `extensions` and puts that schema on the
-- search path for every connection. A bare Postgres does not, so crypt() and
-- gen_salt() do not resolve, and a migration that seeds a user with a password
-- fails. Setting it on the database rather than reinstalling the extension
-- keeps the harness matching production.
do $$
begin
  execute format('alter database %I set search_path = public, extensions',
                 current_database());
end $$;
set search_path = public, extensions;
create or replace function auth.uid() returns uuid language sql stable as
  $fn$ select nullif(current_setting('request.jwt.claims',true)::json->>'sub','')::uuid $fn$;
create or replace function auth.role() returns text language sql stable as
  $fn$ select coalesce(current_setting('request.jwt.claims',true)::json->>'role','anon') $fn$;
create or replace function auth.jwt() returns jsonb language sql stable as
  $fn$ select coalesce(current_setting('request.jwt.claims',true)::jsonb,'{}'::jsonb) $fn$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname='supabase_admin') then create role supabase_admin nologin; end if;
end $$;

-- Supabase grants these at project bootstrap, and a dump of the schema carries
-- no GRANT. A side database built from the dump alone therefore has no role
-- that can read anything, and every RLS test fails on permission rather than
-- on policy. This belongs to the harness, not to the tests.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;


-- Supabase creates this publication, and migrations add tables to it. Without
-- it `alter publication supabase_realtime add table …` fails, and a build that
-- goes on past the error loses every migration after that one, silently.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- Roles and schemas Supabase provides that a bare Postgres does not.
do $$
declare r text;
begin
  foreach r in array array['anon','authenticated','service_role',
                            'supabase_admin','authenticator',
                            'supabase_auth_admin','dashboard_user'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
end $$;

create schema if not exists storage;
create schema if not exists realtime;
create schema if not exists graphql_public;


-- storage.buckets, which a migration that creates a bucket inserts into. The
-- columns are the ones Supabase exposes; nothing here reads them, so the
-- shape only has to be wide enough for the insert to land.
create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  owner              uuid,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  public             boolean default false,
  avif_autodetection boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  owner_id           text);

create table if not exists storage.objects (
  id               uuid primary key default gen_random_uuid(),
  bucket_id        text references storage.buckets(id),
  name             text,
  owner            uuid,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata         jsonb,
  path_tokens      text[],
  version          text,
  owner_id         text);


-- Supabase's storage helpers, used inside RLS policies on storage.objects.
create or replace function storage.foldername(name text)
returns text[] language sql immutable as $fn$
  select string_to_array(name, '/');
$fn$;

create or replace function storage.filename(name text)
returns text language sql immutable as $fn$
  select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)];
$fn$;

create or replace function storage.extension(name text)
returns text language sql immutable as $fn$
  select nullif(split_part(storage.filename(name), '.', 2), '');
$fn$;


-- auth.identities, which a migration that creates a user with a password writes
-- to. Supabase creates one row per provider per user; the shape here is the
-- subset such a migration uses.
create table if not exists auth.identities (
  id              text,
  user_id         uuid references auth.users(id) on delete cascade,
  identity_data   jsonb not null,
  provider        text not null,
  provider_id     text,
  last_sign_in_at timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  email           text,
  -- a plain surrogate key: Postgres will not take an expression in a primary
  -- key, and nothing here depends on the real composite.
  identity_pk     bigserial primary key);
