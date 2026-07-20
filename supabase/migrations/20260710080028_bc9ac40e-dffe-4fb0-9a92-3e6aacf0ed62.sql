
REVOKE EXECUTE ON FUNCTION public.is_company_member(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_company_steward(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_company_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_steward(UUID) TO authenticated;
