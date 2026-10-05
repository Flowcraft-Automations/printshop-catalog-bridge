grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant execute on all functions in schema public to anon, authenticated;
grant usage on all sequences in schema public to authenticated;
