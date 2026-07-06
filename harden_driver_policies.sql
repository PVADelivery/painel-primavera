-- Run in Supabase SQL editor as project owner.
-- Hardens delivery_drivers RLS: blocks self-enrollment as driver
-- and prevents drivers from editing commission_rate / rating.

DROP POLICY IF EXISTS "Driver inserts own row" ON public.delivery_drivers;
CREATE POLICY "Driver inserts own row"
  ON public.delivery_drivers
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.has_role(auth.uid(), 'driver')
      OR public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS "Driver updates own row" ON public.delivery_drivers;
CREATE POLICY "Driver updates own row"
  ON public.delivery_drivers
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.prevent_driver_sensitive_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.commission_rate IS DISTINCT FROM OLD.commission_rate THEN
    NEW.commission_rate := OLD.commission_rate;
  END IF;
  IF NEW.rating IS DISTINCT FROM OLD.rating THEN
    NEW.rating := OLD.rating;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_drivers_lock_sensitive ON public.delivery_drivers;
CREATE TRIGGER trg_drivers_lock_sensitive
  BEFORE UPDATE ON public.delivery_drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_driver_sensitive_updates();
