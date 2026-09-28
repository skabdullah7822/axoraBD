ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS duplicate_ip boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_duplicate_ip
  ON public.profiles(referred_by, duplicate_ip)
  WHERE referred_by IS NOT NULL;

CREATE OR REPLACE FUNCTION public.mark_duplicate_ip_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.signup_ip IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.signup_ip = NEW.signup_ip
      AND p.user_id <> NEW.user_id
  ) THEN
    NEW.duplicate_ip := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_duplicate_ip_referral ON public.profiles;
CREATE TRIGGER trg_mark_duplicate_ip_referral
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_duplicate_ip_referral();

CREATE OR REPLACE FUNCTION public.get_my_referrals()
RETURNS TABLE(id uuid, username text, status text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, username, status, created_at
  FROM public.profiles
  WHERE referred_by = auth.uid()
    AND duplicate_ip = false
  ORDER BY created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.get_my_referral_summary()
RETURNS TABLE(valid_count bigint, duplicate_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    count(*) FILTER (WHERE duplicate_ip = false),
    count(*) FILTER (WHERE duplicate_ip = true)
  FROM public.profiles
  WHERE referred_by = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.mark_duplicate_ip_referral() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_referrals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_referrals() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_referral_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_referral_summary() TO authenticated;

UPDATE public.profiles p
SET duplicate_ip = true
WHERE p.referred_by IS NOT NULL
  AND p.signup_ip IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles other
    WHERE other.signup_ip = p.signup_ip
      AND other.user_id <> p.user_id
  );

INSERT INTO public.notifications (user_id, title, message, type)
SELECT p.user_id,
  'Referral not counted',
  'You opened ' || count(*)::text || ' duplicate account(s) from the same IP address. Those accounts were not counted as valid referrals and no referral bonus was awarded for them.',
  'warning'
FROM public.profiles p
WHERE p.referred_by IS NOT NULL AND p.duplicate_ip = true
GROUP BY p.user_id;

UPDATE public.referral_earnings e
SET status = 'rejected'
WHERE EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.user_id = e.referred_id AND p.duplicate_ip = true
)
  AND e.status <> 'rejected';

REVOKE EXECUTE ON FUNCTION public.mark_duplicate_ip_referral() FROM PUBLIC, anon, authenticated;
