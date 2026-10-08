-- qa-master/db/rules/unit-tests.sql
--
-- MDVD's business rules, as the database must hold them. Run by
-- project.business_rules on a database built from schema.sql (the snapshot of
-- the live project), the migrations, and the engine's harness.
--
-- MDVD is a print shop's catalog console: families of products (stickers,
-- flyers, signs ...), each product a size and a quantity with prices in the
-- shop's two systems. Who may see and change what is decided per family, and
-- the database is what enforces it: the screens only hide what the database
-- already refuses (.lovable/plan/hide-unauthorized-families-from-non-admin-users-2026-08-23.md:17).
--
-- Every rule names where it comes from, at commit 89f092f: the policy or
-- function in schema.sql, and the code that relies on it. Nothing here is a
-- rule the code does not state. What the code leaves open is a question for
-- Yulia, not a test (the PR lists them).
--
-- A failure is raised as FAIL <rule>: <what>. Before each check that expects
-- nothing (0 rows, a refusal), a positive control shows the same query does
-- find something, so a zero means the rule and not an empty table.
--
-- Where a check does not expect a refusal, the database refusing is a
-- failure of that rule too: each block a user runs ends in a handler that
-- says so the same way. The handlers use a bare raise (level EXCEPTION by
-- default), so the engine's count of assertions counts the checks and not
-- the handlers.
--
-- One transaction, rolled back: nothing it writes stays.

begin;

-- ---------------------------------------------------------------------------
-- The population. Two families of our own, so the rules do not depend on the
-- families the pricing migration seeds. Users are created the way Supabase
-- creates them, by a row in auth.users; handle_new_user gives each a profile
-- and the role 'user'.
--   admin   is an admin (user_roles)
--   ana     may work on family qa-a
--   ben     may work on family qa-b
--   nadav   has no family at all
-- ---------------------------------------------------------------------------

insert into public.families (family, items_count) values ('qa-a', 2), ('qa-b', 1);

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-000000000001', 'admin@qa.test', '{"display_name":"QA admin"}'),
  ('a0000000-0000-4000-8000-00000000000a', 'ana@qa.test',   '{"display_name":"Ana"}'),
  ('a0000000-0000-4000-8000-00000000000b', 'ben@qa.test',   '{"display_name":"Ben"}'),
  ('a0000000-0000-4000-8000-00000000000e', 'nadav@qa.test', null);

insert into public.user_roles (user_id, role) values
  ('a0000000-0000-4000-8000-000000000001', 'admin');
insert into public.user_family_access (user_id, family) values
  ('a0000000-0000-4000-8000-00000000000a', 'qa-a'),
  ('a0000000-0000-4000-8000-00000000000b', 'qa-b');

insert into public.products (id, row_key, name, family, width_cm, height_cm, qty, final_price) values
  ('b0000000-0000-4000-8000-0000000000a1', 'qa-a-5x5-100',  'qa-a 5/5 100',  'qa-a', 5,  5,  100, 126),
  ('b0000000-0000-4000-8000-0000000000a2', 'qa-a-8x8-250',  'qa-a 8/8 250',  'qa-a', 8,  8,  250, 190),
  ('b0000000-0000-4000-8000-0000000000b1', 'qa-b-a5-1000',  'qa-b A5 1000',  'qa-b', 15, 21, 1000, 395);

insert into public.product_notes (product_id, body) values
  ('b0000000-0000-4000-8000-0000000000a1', 'a note on a qa-a product'),
  ('b0000000-0000-4000-8000-0000000000b1', 'a note on a qa-b product');
insert into public.product_history (product_id, field, old_value, new_value) values
  ('b0000000-0000-4000-8000-0000000000a1', 'final_price', '120', '126'),
  ('b0000000-0000-4000-8000-0000000000b1', 'final_price', '380', '395');

insert into public.business_config (id, monthly_cost, monthly_revenue) values (1, 1, 1);


-- ===========================================================================
-- 1 · Signed out, nothing of the catalog is readable or writable.
--     The app renders only with a session (src/components/AuthGate.tsx:41-42);
--     every catalog policy is `to authenticated` (schema.sql:242-295).
-- ===========================================================================
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
do $$
declare n int;
begin
  select count(*) into n from public.products;
  if n <> 0 then raise exception 'FAIL signed-out: a visitor without a session reads % product(s)', n; end if;
  select count(*) into n from public.families;
  if n <> 0 then raise exception 'FAIL signed-out: a visitor without a session reads % famil(ies)', n; end if;
  select (select count(*) from public.product_notes) + (select count(*) from public.product_history)
       + (select count(*) from public.business_config) into n;
  if n <> 0 then raise exception 'FAIL signed-out: a visitor reads % note, history or business_config row(s)', n; end if;
  begin
    insert into public.products (row_key, name, family) values ('qa-anon', 'anon', 'qa-a');
    raise exception 'FAIL signed-out: a visitor without a session created a product';
  exception when insufficient_privilege then null;
  end;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL signed-out: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;
-- positive control: the rows a visitor must not see are there
do $$
begin
  if (select count(*) from public.products where family in ('qa-a','qa-b')) <> 3 then
    raise exception 'FAIL signed-out: positive control failed: the three seeded products are not there';
  end if;
end $$;


-- ===========================================================================
-- 2 · A user works only in the families an admin gave them.
--     The screens filter by the granted list (src/lib/auth.tsx:44-50,
--     src/routes/catalog.tsx:436-451); the database enforces it through
--     has_family_access (schema.sql:168-179) on families and products
--     (schema.sql:247-265).
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
do $$
declare n int;
begin
  -- positive control: ana sees her own family's two products
  select count(*) into n from public.products where family = 'qa-a';
  if n <> 2 then
    raise exception 'FAIL family-access: positive control failed: ana sees % of the 2 products of her family qa-a', n;
  end if;
  select count(*) into n from public.products where family <> 'qa-a';
  if n <> 0 then raise exception 'FAIL family-access: ana reads % product(s) outside her family', n; end if;
  select count(*) into n from public.families where family <> 'qa-a';
  if n <> 0 then raise exception 'FAIL family-access: ana sees % family name(s) she was not given', n; end if;

  -- she cannot change a product of another family: the update finds nothing
  update public.products set final_price = 1 where id = 'b0000000-0000-4000-8000-0000000000b1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL family-access: ana changed the price of a qa-b product'; end if;

  -- she cannot add a product to a family she was not given
  -- (src/routes/new-product.tsx:61-74, src/routes/calculator.tsx:467-477 insert with a chosen family)
  begin
    insert into public.products (row_key, name, family) values ('qa-ana-into-b', 'x', 'qa-b');
    raise exception 'FAIL family-access: ana created a product in qa-b, a family she was not given';
  exception when insufficient_privilege then null;
  end;

  -- nor move one of hers into such a family (with check, schema.sql:261-263)
  begin
    update public.products set family = 'qa-b' where id = 'b0000000-0000-4000-8000-0000000000a2';
    raise exception 'FAIL family-access: ana moved her product into qa-b, a family she was not given';
  exception when insufficient_privilege then null;
  end;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL family-access: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;
do $$
begin
  if (select final_price from public.products where id = 'b0000000-0000-4000-8000-0000000000b1') <> 395 then
    raise exception 'FAIL family-access: the qa-b price changed after ana''s update';
  end if;
end $$;

-- a user with no family sees no catalog at all
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-4000-8000-00000000000e","role":"authenticated"}';
do $$
declare n int;
begin
  select (select count(*) from public.products) + (select count(*) from public.families) into n;
  if n <> 0 then raise exception 'FAIL family-access: nadav, who has no family, sees % catalog row(s)', n; end if;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL family-access: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;


-- ===========================================================================
-- 3 · An admin sees every family.
--     For an admin the app sets no family filter at all (src/lib/auth.tsx:50:
--     allowedFamilies null); has_family_access is true for is_admin()
--     (schema.sql:174).
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare n int;
begin
  select count(*) into n from public.products where family in ('qa-a','qa-b');
  if n <> 3 then raise exception 'FAIL admin-sees-all: the admin sees % of the 3 products of qa-a and qa-b', n; end if;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL admin-sees-all: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;


-- ===========================================================================
-- 4 · A product's notes and history belong to its family.
--     Notes and history are read per product (src/lib/queries.ts:25-38,
--     74-92, src/routes/catalog.tsx:1053-1060); their policies go through the
--     product's family (schema.sql:267-295). Deleting history is admin-only
--     (schema.sql:276-277).
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
do $$
declare n int;
begin
  -- positive control: ana sees the note and the history line of her product
  select (select count(*) from public.product_notes where product_id = 'b0000000-0000-4000-8000-0000000000a1')
       + (select count(*) from public.product_history where product_id = 'b0000000-0000-4000-8000-0000000000a1') into n;
  if n <> 2 then
    raise exception 'FAIL notes-history: positive control failed: ana sees % of the note and history line of her own product', n;
  end if;
  select (select count(*) from public.product_notes where product_id = 'b0000000-0000-4000-8000-0000000000b1')
       + (select count(*) from public.product_history where product_id = 'b0000000-0000-4000-8000-0000000000b1') into n;
  if n <> 0 then raise exception 'FAIL notes-history: ana reads % note or history line of a qa-b product', n; end if;
  begin
    insert into public.product_notes (product_id, body) values ('b0000000-0000-4000-8000-0000000000b1', 'x');
    raise exception 'FAIL notes-history: ana wrote a note on a qa-b product';
  exception when insufficient_privilege then null;
  end;
  delete from public.product_history where product_id = 'b0000000-0000-4000-8000-0000000000a1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL notes-history: ana, not an admin, deleted % history line(s)', n; end if;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL notes-history: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;


-- ===========================================================================
-- 5 · Only an admin deletes a product.
--     schema.sql:256 and 264-265 ("delete admin-only"). For anyone else the
--     delete finds nothing and the product stays. (The catalog's menu offers
--     the delete to every user, src/routes/catalog.tsx:2353-2366: a question
--     for Yulia, in the PR.)
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
do $$
declare n int;
begin
  delete from public.products where id = 'b0000000-0000-4000-8000-0000000000a2';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL delete-admin-only: ana, not an admin, deleted a product of her own family'; end if;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL delete-admin-only: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;
do $$
begin
  if not exists (select 1 from public.products where id = 'b0000000-0000-4000-8000-0000000000a2') then
    raise exception 'FAIL delete-admin-only: the product is gone after a non-admin''s delete';
  end if;
end $$;
-- positive control: the same delete, by the admin, removes it
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare n int;
begin
  delete from public.products where id = 'b0000000-0000-4000-8000-0000000000a2';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL delete-admin-only: positive control failed: the admin''s delete removed % product(s), expected 1', n; end if;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL delete-admin-only: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;


-- ===========================================================================
-- 6 · Family pricing: whoever has the family edits its configuration; only an
--     admin adds or removes a family.
--     The client's rule of 2026-09-23 "all users can edit configurations, not
--     only admin" (supabase/migrations/20260923090000_families_update_by_family_access.sql:1-4,
--     schema.sql:250-252); the calculator saves it (src/routes/calculator.tsx:397-409);
--     inserts and deletes stay admin-only (same migration, :4; schema.sql:253-254).
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
do $$
declare n int;
begin
  -- positive control: ana saves the configuration of her own family
  update public.families set cost_per_m2 = 3, pricing_config = '{"v3":{"margin":1.3}}' where family = 'qa-a';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FAIL family-config: positive control failed: ana could not save the configuration of her own family (% rows)', n;
  end if;
  update public.families set cost_per_m2 = 3 where family = 'qa-b';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL family-config: ana changed the configuration of qa-b, a family she was not given'; end if;
  begin
    insert into public.families (family) values ('qa-new-by-ana');
    raise exception 'FAIL family-config: ana, not an admin, created a family';
  exception when insufficient_privilege then null;
  end;
  delete from public.families where family = 'qa-a';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL family-config: ana, not an admin, deleted her family'; end if;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL family-config: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;


-- ===========================================================================
-- 7 · No one gives themselves a role or a family; each reads only their own.
--     Roles and families are changed only after assertAdmin, through the
--     service role (src/lib/admin.functions.ts:12-21, 94-133); a user loads
--     their own (src/lib/auth.tsx:44-47). Policies: schema.sql:305-315.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
do $$
declare n int;
begin
  -- positive control: ana reads her own role and her own family
  select (select count(*) from public.user_roles where user_id = 'a0000000-0000-4000-8000-00000000000a' and role = 'user')
       + (select count(*) from public.user_family_access where user_id = 'a0000000-0000-4000-8000-00000000000a' and family = 'qa-a') into n;
  if n <> 2 then raise exception 'FAIL self-grant: positive control failed: ana reads % of her own role and family', n; end if;
  select (select count(*) from public.user_roles where user_id <> 'a0000000-0000-4000-8000-00000000000a')
       + (select count(*) from public.user_family_access where user_id <> 'a0000000-0000-4000-8000-00000000000a')
       + (select count(*) from public.profiles where id <> 'a0000000-0000-4000-8000-00000000000a') into n;
  if n <> 0 then raise exception 'FAIL self-grant: ana reads % role, family or profile row(s) of other users', n; end if;
  begin
    insert into public.user_roles (user_id, role) values ('a0000000-0000-4000-8000-00000000000a', 'admin');
    raise exception 'FAIL self-grant: ana made herself an admin';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.user_family_access (user_id, family) values ('a0000000-0000-4000-8000-00000000000a', 'qa-b');
    raise exception 'FAIL self-grant: ana gave herself the family qa-b';
  exception when insufficient_privilege then null;
  end;
  if public.is_admin() then raise exception 'FAIL self-grant: ana counts as an admin'; end if;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL self-grant: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;


-- ===========================================================================
-- 8 · Every new user gets a profile and the role 'user'.
--     createUser adds only the admin role, and only when asked
--     (src/lib/admin.functions.ts:79-90); the profile and the role 'user' come
--     from handle_new_user (schema.sql:192-215). The first-admin screen is
--     offered while profiles is empty (src/lib/admin.functions.ts:23-30).
-- ===========================================================================
do $$
declare r record;
begin
  select p.display_name, p.email,
         exists (select 1 from public.user_roles u where u.user_id = p.id and u.role = 'user') as is_user
    into r from public.profiles p where p.id = 'a0000000-0000-4000-8000-00000000000a';
  if not found then raise exception 'FAIL new-user: a user created in auth.users has no profile'; end if;
  if not r.is_user then raise exception 'FAIL new-user: a new user did not get the role user'; end if;
  if r.display_name is distinct from 'Ana' then
    raise exception 'FAIL new-user: the display name given at creation was not kept';
  end if;
  -- created without a display name, the email stands in for it (schema.sql:200)
  if (select display_name from public.profiles where id = 'a0000000-0000-4000-8000-00000000000e') is distinct from 'nadav@qa.test' then
    raise exception 'FAIL new-user: a user created without a display name is not shown by email';
  end if;
end $$;


-- ===========================================================================
-- 9 · A product's row_key is unique, and its family exists.
--     The import matches products by row_key and updates by it
--     (src/routes/import.tsx:181, 199-201); it creates the new families before
--     the products that name them (src/routes/import.tsx:165-170).
--     schema.sql:42 (unique) and :44 (references families).
-- ===========================================================================
do $$
begin
  begin
    insert into public.products (row_key, name, family) values ('qa-a-5x5-100', 'a second row with the same key', 'qa-a');
    raise exception 'FAIL catalog-keys: a second product with an existing row_key was accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.products (row_key, name, family) values ('qa-orphan', 'no such family', 'qa-no-such-family');
    raise exception 'FAIL catalog-keys: a product in a family that does not exist was accepted';
  exception when foreign_key_violation then null;
  end;
end $$;


-- ===========================================================================
-- 10 · Business figures: every signed-in user reads them, only an admin writes.
--      The app reads business_config (src/lib/queries.ts:5-21);
--      schema.sql:241-245.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
do $$
declare n int;
begin
  select count(*) into n from public.business_config where id = 1;
  if n <> 1 then raise exception 'FAIL business-config: positive control failed: ana cannot read the business figures'; end if;
  update public.business_config set monthly_cost = 2 where id = 1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL business-config: ana, not an admin, changed the business figures'; end if;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL business-config: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;

rollback;
