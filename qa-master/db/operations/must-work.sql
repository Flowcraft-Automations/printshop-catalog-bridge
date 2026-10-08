-- qa-master/db/operations/must-work.sql
--
-- What MDVD's people do every day, done here the way the app does it: the
-- same tables, the same columns, as the same role. Run by
-- project.must_work_operations on a database built from schema.sql, the
-- migrations and the engine's harness.
--
-- Two kinds of caller, as in the code:
--   a signed-in user, through the browser client (role authenticated, with
--   the user's id in the JWT), and
--   the server functions in src/lib/admin.functions.ts, which act through
--   supabaseAdmin (role service_role) after assertAdmin.
-- Creating and deleting a login is Supabase Auth's (auth.admin.createUser,
-- deleteUser); here it is the row in auth.users that Auth writes.
--
-- Every operation names the code it comes from, at commit 89f092f, and checks
-- its result, not only that it ran. A failure is raised as
-- FAIL <operation>: <what>. Reads are preceded by a positive control: the rows
-- are there, so a user who sees none of them is a finding, not an empty table.
--
-- An operation the database refuses (no permission, a constraint, a column
-- the code writes that is not there) has failed too: each block ends in a
-- handler that says so the same way. The handlers use a bare raise (level
-- EXCEPTION by default), so the engine's count of assertions counts the
-- checks and not the handlers.
--
-- One transaction, rolled back: nothing it writes stays.

begin;

-- ===========================================================================
-- 1 · The first admin, on an empty project.
--     bootstrapStatus offers the first-admin screen while profiles is empty;
--     bootstrapAdmin creates the login and upserts the role admin
--     (src/lib/admin.functions.ts:23-50, src/components/AuthGate.tsx:14-28).
-- ===========================================================================
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
do $$
begin
  if (select count(*) from public.profiles) <> 0 then
    raise exception 'FAIL first-admin: profiles is not empty on a new project, so the first-admin screen would not be offered';
  end if;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL first-admin: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;

insert into auth.users (id, email, email_confirmed_at)
values ('c0000000-0000-4000-8000-000000000001', 'first-admin@qa.test', now());

set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
do $$
begin
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'FAIL first-admin: after the first login was created profiles holds % row(s), so the screen would be offered again',
      (select count(*) from public.profiles);
  end if;
  insert into public.user_roles (user_id, role) values ('c0000000-0000-4000-8000-000000000001', 'admin')
    on conflict (user_id, role) do nothing;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL first-admin: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
begin
  if not public.is_admin() then
    raise exception 'FAIL first-admin: the first admin, signed in, is not an admin';
  end if;
  -- what the app reads on sign-in (src/lib/auth.tsx:44-48)
  if not exists (select 1 from public.user_roles where user_id = 'c0000000-0000-4000-8000-000000000001' and role = 'admin') then
    raise exception 'FAIL first-admin: signed in, the first admin cannot read their own role admin';
  end if;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL first-admin: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;


-- ===========================================================================
-- 2 · An admin opens a family and gives a new user access to it.
--     The import creates a family that does not exist yet
--     (src/routes/import.tsx:165-170); createUser makes the login with a
--     display name (src/lib/admin.functions.ts:71-92); setUserFamilies replaces
--     the user's families (:120-133); listUsers shows the result (:52-69).
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
begin
  insert into public.families (family, items_count) values ('qa-stickers', 0);
  if not exists (select 1 from public.families where family = 'qa-stickers') then
    raise exception 'FAIL user-admin: the admin does not see the family they just opened';
  end if;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL user-admin: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values ('c0000000-0000-4000-8000-00000000000a', 'worker@qa.test', now(), '{"display_name":"Worker"}');

set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
do $$
declare n int;
begin
  delete from public.user_family_access where user_id = 'c0000000-0000-4000-8000-00000000000a';
  insert into public.user_family_access (user_id, family) values ('c0000000-0000-4000-8000-00000000000a', 'qa-stickers');
  select count(*) into n
    from public.profiles p
    join public.user_family_access f on f.user_id = p.id
   where p.id = 'c0000000-0000-4000-8000-00000000000a' and p.display_name = 'Worker' and f.family = 'qa-stickers';
  if n <> 1 then
    raise exception 'FAIL user-admin: listUsers does not show the new user with their name and family (% rows)', n;
  end if;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL user-admin: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;


-- ===========================================================================
-- 3 · The user signs in and gets their permissions.
--     src/lib/auth.tsx:44-50: their roles and their families, by their id.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
do $$
declare roles text[]; fams text[];
begin
  select array_agg(role::text) into roles from public.user_roles where user_id = 'c0000000-0000-4000-8000-00000000000a';
  select array_agg(family) into fams from public.user_family_access where user_id = 'c0000000-0000-4000-8000-00000000000a';
  if roles is distinct from array['user'] then
    raise exception 'FAIL sign-in: the user''s roles read as %, expected {user}', roles;
  end if;
  if fams is distinct from array['qa-stickers'] then
    raise exception 'FAIL sign-in: the user''s families read as %, expected {qa-stickers}', fams;
  end if;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL sign-in: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;


-- ===========================================================================
-- 4 · The user adds products to their family.
--     The new-product screen (src/routes/new-product.tsx:59-74) and a price
--     anchor from the calculator (src/routes/calculator.tsx:467-477), with
--     the columns each one writes.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
do $$
declare n int;
begin
  insert into public.products (row_key, name, family, width_cm, height_cm, qty, final_price, notes, source, senzey_status, site_status)
  values ('qa-sticker-5x5-1', 'qa sticker 5/5', 'qa-stickers', 5, 5, 100, 126, null, 'manual', 'to_add', 'to_add');
  insert into public.products (row_key, name, family, width_cm, height_cm, qty, final_price, is_anchor, source)
  values ('qa-stickers-8x8-250-1', 'qa-stickers 8/8 — 250 יח׳', 'qa-stickers', 8, 8, 250, 190, true, 'calculator');
  select count(*) into n from public.products
   where family = 'qa-stickers'
     and ((row_key = 'qa-sticker-5x5-1' and qty = 100 and final_price = 126 and senzey_status = 'to_add' and site_status = 'to_add')
       or (row_key = 'qa-stickers-8x8-250-1' and is_anchor and source = 'calculator'));
  if n <> 2 then
    raise exception 'FAIL add-product: the user reads back % of the 2 products they created', n;
  end if;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL add-product: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;


-- ===========================================================================
-- 5 · The user reads the catalog, as its screens load it.
--     families (src/lib/queries.ts:61-72), products, a page at a time
--     (:40-59), notes (:74-92), a product's history (:25-38) and the business
--     figures (:5-22).
-- ===========================================================================
-- seed what the user did not write: a note and a history line, and the
-- business figures an admin keeps
insert into public.product_notes (product_id, body)
  select id, 'printed on matte' from public.products where row_key = 'qa-sticker-5x5-1';
insert into public.product_history (product_id, field, old_value, new_value)
  select id, 'final_price', '120', '126' from public.products where row_key = 'qa-sticker-5x5-1';
insert into public.business_config (id, monthly_cost, monthly_revenue, overhead_factor) values (1, 200000, 175000, 2)
  on conflict (id) do nothing;
-- positive control: all of it is there
do $$
begin
  if (select count(*) from public.product_notes n join public.products p on p.id = n.product_id where p.family = 'qa-stickers') <> 1
     or (select count(*) from public.product_history h join public.products p on p.id = h.product_id where p.family = 'qa-stickers') <> 1 then
    raise exception 'FAIL read-catalog: positive control failed: the seeded note and history line are not there';
  end if;
end $$;

set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
do $$
declare n int; fam text;
begin
  select family into fam from public.families order by items_count desc nulls last limit 1;
  if fam is distinct from 'qa-stickers' then
    raise exception 'FAIL read-catalog: the families screen shows %, expected the user''s family qa-stickers', fam;
  end if;
  select count(*) into n from (select * from public.products order by family, name offset 0 limit 1000) page;
  if n <> 2 then raise exception 'FAIL read-catalog: the first page of products holds % of the user''s 2', n; end if;
  select count(*) into n from (select * from public.product_notes order by created_at desc offset 0 limit 1000) page;
  if n <> 1 then raise exception 'FAIL read-catalog: the user reads % of the 1 note on their family', n; end if;
  select count(*) into n from public.product_history h
   where h.product_id = (select id from public.products where row_key = 'qa-sticker-5x5-1');
  if n <> 1 then raise exception 'FAIL read-catalog: the product''s history shows % of its 1 line', n; end if;
  select count(*) into n from public.business_config where id = 1;
  if n <> 1 then raise exception 'FAIL read-catalog: the user cannot read the business figures'; end if;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL read-catalog: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;


-- ===========================================================================
-- 6 · The user changes prices and statuses.
--     The catalog's edit, with the status derived from the price: a first
--     price makes it 'exists' (src/routes/catalog.tsx:750-779,
--     src/lib/mdvd.ts:242-271); the migration screen's status
--     (src/routes/migration.tsx:44-50); the calculator's anchor toggle and
--     anchor price (src/routes/calculator.tsx:438-450, 486).
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
do $$
declare n int; r record;
begin
  update public.products set senzey_price = 140, senzey_status = 'exists', updated_at = now()
   where id in (select id from public.products where row_key = 'qa-sticker-5x5-1');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL edit-product: the price edit changed % product(s), expected 1', n; end if;
  update public.products set site_status = 'done', updated_at = now() where row_key = 'qa-sticker-5x5-1';
  update public.products set is_anchor = false where row_key = 'qa-stickers-8x8-250-1';
  update public.products set width_cm = 8, height_cm = 8, qty = 250, final_price = 185
   where row_key = 'qa-stickers-8x8-250-1';
  select (select senzey_price from public.products where row_key = 'qa-sticker-5x5-1') as senzey_price,
         (select senzey_status from public.products where row_key = 'qa-sticker-5x5-1') as senzey_status,
         (select site_status from public.products where row_key = 'qa-sticker-5x5-1') as site_status,
         (select is_anchor from public.products where row_key = 'qa-stickers-8x8-250-1') as is_anchor,
         (select final_price from public.products where row_key = 'qa-stickers-8x8-250-1') as anchor_price
    into r;
  if r.senzey_price is distinct from 140 or r.senzey_status is distinct from 'exists' or r.site_status is distinct from 'done'
     or r.is_anchor is distinct from false or r.anchor_price is distinct from 185 then
    raise exception 'FAIL edit-product: the edits did not all land (%)', r;
  end if;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL edit-product: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;


-- ===========================================================================
-- 7 · The user saves their family's pricing configuration.
--     src/routes/calculator.tsx:397-409, allowed to every user of the family
--     since the client's rule of 2026-09-23
--     (supabase/migrations/20260923090000_families_update_by_family_access.sql:1-4).
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
do $$
declare n int;
begin
  update public.families
     set outsource_width_cm = null, outsource_height_cm = null, cost_per_m2 = 2.8, outsource_cost_per_m2 = 6,
         pricing_config = '{"v3":{"engine":"two_machine_sheet","margin":1.3,"min_job_price":20}}'
   where family = 'qa-stickers';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL family-config: saving the family configuration changed % row(s), expected 1', n; end if;
  if (select pricing_config #>> '{v3,min_job_price}' from public.families where family = 'qa-stickers') is distinct from '20' then
    raise exception 'FAIL family-config: the saved configuration does not read back';
  end if;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL family-config: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;


-- ===========================================================================
-- 8 · The user writes, edits and deletes a note.
--     src/components/NotesPanel.tsx:28-62.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-4000-8000-00000000000a","role":"authenticated"}';
do $$
declare pid uuid; nid uuid; n int;
begin
  select id into pid from public.products where row_key = 'qa-stickers-8x8-250-1';
  insert into public.product_notes (product_id, body) values (pid, 'customer asked for gloss') returning id into nid;
  update public.product_notes set body = 'customer asked for gloss, twice' where id = nid;
  get diagnostics n = row_count;
  if n <> 1 or (select body from public.product_notes where id = nid) is distinct from 'customer asked for gloss, twice' then
    raise exception 'FAIL notes: editing the user''s own note did not land';
  end if;
  delete from public.product_notes where id = nid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL notes: deleting the note removed % row(s), expected 1', n; end if;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL notes: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;


-- ===========================================================================
-- 9 · An admin imports a sheet.
--     src/routes/import.tsx:161-201: new families inserted, the count of
--     existing ones updated, new products inserted in batches, existing
--     products updated by row_key.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare n int;
begin
  insert into public.families (family, items_count) values ('qa-flyers', 1);
  update public.families set items_count = 3 where family = 'qa-stickers';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL import: updating an existing family''s count changed % row(s)', n; end if;
  insert into public.products (row_key, name, family, width_cm, height_cm, qty, source)
  values ('qa-flyer-a5-1000', 'qa flyer A5', 'qa-flyers', 15, 21, 1000, 'import'),
         ('qa-sticker-3x3-100', 'qa sticker 3/3', 'qa-stickers', 3, 3, 100, 'import');
  update public.products set name = 'qa sticker 5/5 (iStores)', site_url = 'https://example.test/p/1', updated_at = now()
   where row_key = 'qa-sticker-5x5-1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL import: updating a product by its row_key changed % row(s), expected 1', n; end if;
  select count(*) into n from public.products where family in ('qa-stickers','qa-flyers');
  if n <> 4 then raise exception 'FAIL import: after the import the two families hold % product(s), expected 4', n; end if;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL import: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;


-- ===========================================================================
-- 10 · An admin deletes a product, with its notes and its history.
--      src/routes/catalog.tsx:815-823: notes, then history, then the product,
--      each delete checked for an error. The confirm says it all goes
--      (:2356).
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare pid uuid; n int;
begin
  select id into pid from public.products where row_key = 'qa-sticker-5x5-1';
  -- positive control: the admin sees the note and the history line about to go
  select (select count(*) from public.product_notes where product_id = pid)
       + (select count(*) from public.product_history where product_id = pid) into n;
  if n <> 2 then raise exception 'FAIL delete-product: positive control failed: the admin sees % of the note and history line', n; end if;
  delete from public.product_notes where product_id = pid;
  delete from public.product_history where product_id = pid;
  delete from public.products where id = pid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL delete-product: the admin''s delete removed % product(s), expected 1', n; end if;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL delete-product: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;
do $$
begin
  if exists (select 1 from public.products where row_key = 'qa-sticker-5x5-1')
     or exists (select 1 from public.product_notes n left join public.products p on p.id = n.product_id where p.id is null)
     or exists (select 1 from public.product_history h left join public.products p on p.id = h.product_id where p.id is null) then
    raise exception 'FAIL delete-product: the product, or a note or history line of it, is still there';
  end if;
end $$;


-- ===========================================================================
-- 11 · An admin removes a user.
--      src/lib/admin.functions.ts:148-163: the login goes (Auth), then the
--      user's roles, families and profile.
-- ===========================================================================
delete from auth.users where id = 'c0000000-0000-4000-8000-00000000000a';
set local role service_role;
set local request.jwt.claims to '{"role":"service_role"}';
do $$
begin
  delete from public.user_roles where user_id = 'c0000000-0000-4000-8000-00000000000a';
  delete from public.user_family_access where user_id = 'c0000000-0000-4000-8000-00000000000a';
  delete from public.profiles where id = 'c0000000-0000-4000-8000-00000000000a';
  if exists (select 1 from public.profiles where id = 'c0000000-0000-4000-8000-00000000000a')
     or exists (select 1 from public.user_roles where user_id = 'c0000000-0000-4000-8000-00000000000a')
     or exists (select 1 from public.user_family_access where user_id = 'c0000000-0000-4000-8000-00000000000a') then
    raise exception 'FAIL remove-user: a removed user still has a profile, a role or a family';
  end if;
  -- the products the user created stay: they belong to the family, not to the user
  if (select count(*) from public.products where family = 'qa-stickers') <> 2 then
    raise exception 'FAIL remove-user: removing a user changed the family''s products';
  end if;
exception when insufficient_privilege or integrity_constraint_violation or undefined_column then
  raise 'FAIL remove-user: the database refused it: % (%)', sqlerrm, sqlstate;
end $$;
reset role;

rollback;
