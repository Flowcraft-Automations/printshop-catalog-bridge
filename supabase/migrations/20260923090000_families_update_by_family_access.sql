-- Family pricing configuration can be edited by every user who has access to
-- the family (client 2026-09-23: "all users can edit configurations, not only
-- admin"). Additive: families_write (is_admin, ALL) stays; inserts and deletes
-- remain admin-only. public.products is not touched.
--
-- Applied to project oxqctbevreksfgozklit on 2026-09-23 through the Supabase MCP
-- (migration families_update_by_family_access).
CREATE POLICY families_update_by_access ON public.families
  FOR UPDATE TO authenticated
  USING (has_family_access(family))
  WITH CHECK (has_family_access(family));
