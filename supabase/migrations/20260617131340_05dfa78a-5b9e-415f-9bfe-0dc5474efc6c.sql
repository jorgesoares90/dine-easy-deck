
-- Fix: allow users to bootstrap their own restaurant atomically.
-- Creates a tenant + owner role in one privileged transaction.
CREATE OR REPLACE FUNCTION public.create_tenant_with_owner(_name text, _slug text)
RETURNS public.tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _t public.tenants;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.tenants (name, slug)
  VALUES (_name, _slug)
  RETURNING * INTO _t;

  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (_uid, _t.id, 'owner');

  RETURN _t;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_tenant_with_owner(text, text) TO authenticated;

-- Backfill: assign owner role for the orphan tenant created before this fix
-- to the most recent signed-in user, if exactly one exists.
DO $$
DECLARE
  _uid uuid;
  _tid uuid;
  _user_count int;
  _tenant_count int;
BEGIN
  SELECT count(*) INTO _user_count FROM auth.users;
  SELECT count(*) INTO _tenant_count FROM public.tenants
    WHERE id NOT IN (SELECT tenant_id FROM public.user_roles);
  IF _user_count = 1 AND _tenant_count = 1 THEN
    SELECT id INTO _uid FROM auth.users LIMIT 1;
    SELECT id INTO _tid FROM public.tenants
      WHERE id NOT IN (SELECT tenant_id FROM public.user_roles) LIMIT 1;
    INSERT INTO public.user_roles (user_id, tenant_id, role)
    VALUES (_uid, _tid, 'owner')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
