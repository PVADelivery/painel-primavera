-- Fix execute permissions for has_role and security helper functions
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token TO anon, authenticated, service_role, public;

DO $$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO anon, authenticated, service_role, public';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated, service_role, public';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.has_profile_role(uuid, text) TO anon, authenticated, service_role, public';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_admin_safe() TO anon, authenticated, service_role, public';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_company_safe() TO anon, authenticated, service_role, public';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_driver(uuid) TO anon, authenticated, service_role, public';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_driver_id(uuid) TO anon, authenticated, service_role, public';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated, service_role, public';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) TO anon, authenticated, service_role, public';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
