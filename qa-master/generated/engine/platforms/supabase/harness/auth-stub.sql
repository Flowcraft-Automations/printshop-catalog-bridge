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


-- ─── pg_cron, pg_net and Vault ─────────────────────────────────────────────
-- Supabase ships all three; postgres:16 ships none. A project that schedules
-- work in its database writes `create extension if not exists pg_cron` (and
-- pg_net) in a migration and reads its keys from vault.decrypted_secrets, so on
-- a bare Postgres the build stopped at that line and every rule that builds the
-- database was unrunnable, about a migration nobody got wrong (catalog 0.2.4).
--
-- Supabase's own image is not the way out. Each rule builds a database of its
-- own, under a name of its own, and pg_cron installs only in the database
-- cron.database_name names; Vault is installed only in `postgres`.
--
-- So, as with auth and storage above, the harness stands them in: the objects a
-- migration calls, with the signatures Supabase has, and a row in pg_extension,
-- which is what makes `create extension if not exists` a no-op here. A plain
-- `create extension pg_cron`, without `if not exists`, still fails, on "already
-- exists" rather than "not available". Each one is stood in only where the
-- server cannot install the real one, and only by a superuser, who alone may
-- write that row; anywhere else nothing below runs, and the build is what it was.
--
-- What they do: pg_cron records each schedule in cron.job and never runs it;
-- pg_net records each request in net.http_request_queue and never sends it, so
-- net._http_response stays empty; Vault keeps a value as given, with no key,
-- in a database that is dropped after the rule. None of the three is exposed to
-- anon or authenticated: like Supabase, no grant on their schemas.
--
-- psql's \gset and \if, because every consumer of this file runs it with psql.
select not exists (select 1 from pg_available_extensions where name = 'pg_cron')
       and not exists (select 1 from pg_extension where extname = 'pg_cron')
       and (select rolsuper from pg_roles where rolname = current_user) as qam_stand_in_pg_cron,
       not exists (select 1 from pg_available_extensions where name = 'pg_net')
       and not exists (select 1 from pg_extension where extname = 'pg_net')
       and (select rolsuper from pg_roles where rolname = current_user) as qam_stand_in_pg_net,
       not exists (select 1 from pg_available_extensions where name = 'supabase_vault')
       and not exists (select 1 from pg_extension where extname = 'supabase_vault')
       and (select rolsuper from pg_roles where rolname = current_user) as qam_stand_in_vault
\gset

\if :qam_stand_in_pg_cron
create schema cron;

create table cron.job (
  jobid    bigserial primary key,
  schedule text    not null,
  command  text    not null,
  nodename text    not null default 'localhost',
  nodeport integer not null default 5432,
  database text    not null default current_database(),
  username text    not null default current_user,
  active   boolean not null default true,
  jobname  text,
  unique (jobname, username));

create table cron.job_run_details (
  jobid          bigint,
  runid          bigserial primary key,
  job_pid        integer,
  database       text,
  username       text,
  command        text,
  status         text,
  return_message text,
  start_time     timestamptz,
  end_time       timestamptz);

-- A name already scheduled is replaced in place, as pg_cron does.
create function cron.schedule(job_name text, schedule text, command text)
returns bigint language sql as $fn$
  insert into cron.job (jobname, schedule, command) values ($1, $2, $3)
  on conflict (jobname, username)
  do update set schedule = excluded.schedule, command = excluded.command, active = true
  returning jobid;
$fn$;

create function cron.schedule(schedule text, command text)
returns bigint language sql as $fn$
  insert into cron.job (schedule, command) values ($1, $2) returning jobid;
$fn$;

create function cron.schedule_in_database(job_name text, schedule text, command text,
                                          database text, username text default null,
                                          active boolean default true)
returns bigint language sql as $fn$
  insert into cron.job (jobname, schedule, command, database, username, active)
  values ($1, $2, $3, $4, coalesce($5, current_user), $6)
  on conflict (jobname, username)
  do update set schedule = excluded.schedule, command = excluded.command,
                database = excluded.database, active = excluded.active
  returning jobid;
$fn$;

-- A job that is not there is an error, as it is on Supabase: a migration that
-- unschedules a name it never scheduled fails there too.
create function cron.unschedule(job_name text)
returns boolean language plpgsql as $fn$
begin
  delete from cron.job j where j.jobname = job_name and j.username = current_user;
  if not found then
    raise exception 'could not find valid entry for job ''%''', job_name;
  end if;
  return true;
end $fn$;

create function cron.unschedule(job_id bigint)
returns boolean language plpgsql as $fn$
begin
  delete from cron.job j where j.jobid = job_id;
  if not found then
    raise exception 'could not find valid entry for job %', job_id;
  end if;
  return true;
end $fn$;

create function cron.alter_job(job_id bigint, schedule text default null,
                               command text default null, database text default null,
                               username text default null, active boolean default null)
returns void language plpgsql as $fn$
begin
  update cron.job j
     set schedule = coalesce(alter_job.schedule, j.schedule),
         command  = coalesce(alter_job.command,  j.command),
         database = coalesce(alter_job.database, j.database),
         username = coalesce(alter_job.username, j.username),
         active   = coalesce(alter_job.active,   j.active)
   where j.jobid = job_id;
  if not found then
    raise exception 'could not find valid entry for job %', job_id;
  end if;
end $fn$;

insert into pg_catalog.pg_extension (oid, extname, extowner, extnamespace, extrelocatable, extversion)
values (pg_catalog.pg_nextoid('pg_catalog.pg_extension', 'oid', 'pg_catalog.pg_extension_oid_index'),
        'pg_cron', (select oid from pg_roles where rolname = current_user),
        'pg_catalog'::regnamespace, false, '0-qa-master-stand-in');
\endif

\if :qam_stand_in_pg_net
create schema net;

create table net.http_request_queue (
  id                   bigserial primary key,
  method               text    not null,
  url                  text    not null,
  headers              jsonb,
  body                 bytea,
  timeout_milliseconds integer not null);

create unlogged table net._http_response (
  id           bigint,
  status_code  integer,
  content_type text,
  headers      jsonb,
  content      text,
  timed_out    boolean,
  error_msg    text,
  created      timestamptz not null default now());

create function net.http_get(url text, params jsonb default '{}'::jsonb,
                             headers jsonb default '{}'::jsonb,
                             timeout_milliseconds integer default 5000)
returns bigint language sql as $fn$
  insert into net.http_request_queue (method, url, headers, body, timeout_milliseconds)
  values ('GET', $1, $3, null, $4) returning id;
$fn$;

create function net.http_post(url text, body jsonb default '{}'::jsonb,
                              params jsonb default '{}'::jsonb,
                              headers jsonb default '{"Content-Type": "application/json"}'::jsonb,
                              timeout_milliseconds integer default 5000)
returns bigint language sql as $fn$
  insert into net.http_request_queue (method, url, headers, body, timeout_milliseconds)
  values ('POST', $1, $4, convert_to($2::text, 'UTF8'), $5) returning id;
$fn$;

create function net.http_delete(url text, params jsonb default '{}'::jsonb,
                                headers jsonb default '{}'::jsonb,
                                timeout_milliseconds integer default 5000,
                                body jsonb default null)
returns bigint language sql as $fn$
  insert into net.http_request_queue (method, url, headers, body, timeout_milliseconds)
  values ('DELETE', $1, $3, convert_to($5::text, 'UTF8'), $4) returning id;
$fn$;

insert into pg_catalog.pg_extension (oid, extname, extowner, extnamespace, extrelocatable, extversion)
values (pg_catalog.pg_nextoid('pg_catalog.pg_extension', 'oid', 'pg_catalog.pg_extension_oid_index'),
        'pg_net', (select oid from pg_roles where rolname = current_user),
        'extensions'::regnamespace, false, '0-qa-master-stand-in');
\endif

\if :qam_stand_in_vault
create schema vault;

create table vault.secrets (
  id          uuid        primary key default gen_random_uuid(),
  name        text,
  description text        not null default '',
  secret      text        not null,
  key_id      uuid,
  nonce       bytea,
  created_at  timestamptz not null default current_timestamp,
  updated_at  timestamptz not null default current_timestamp);
create unique index secrets_name_idx on vault.secrets (name) where name is not null;

create view vault.decrypted_secrets as
  select id, name, description, secret, secret as decrypted_secret,
         key_id, nonce, created_at, updated_at
    from vault.secrets;

create function vault.create_secret(new_secret text, new_name text default null,
                                    new_description text default '',
                                    new_key_id uuid default null)
returns uuid language sql as $fn$
  insert into vault.secrets (secret, name, description, key_id)
  values ($1, $2, coalesce($3, ''), $4) returning id;
$fn$;

create function vault.update_secret(secret_id uuid, new_secret text default null,
                                    new_name text default null,
                                    new_description text default null,
                                    new_key_id uuid default null)
returns void language sql as $fn$
  update vault.secrets
     set secret      = coalesce($2, secret),
         name        = coalesce($3, name),
         description = coalesce($4, description),
         key_id      = coalesce($5, key_id),
         updated_at  = current_timestamp
   where id = $1;
$fn$;

insert into pg_catalog.pg_extension (oid, extname, extowner, extnamespace, extrelocatable, extversion)
values (pg_catalog.pg_nextoid('pg_catalog.pg_extension', 'oid', 'pg_catalog.pg_extension_oid_index'),
        'supabase_vault', (select oid from pg_roles where rolname = current_user),
        'vault'::regnamespace, false, '0-qa-master-stand-in');
\endif
