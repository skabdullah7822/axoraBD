-- Keep usernames unique instead of silently appending a numeric suffix during signup.
CREATE OR REPLACE FUNCTION public.reject_duplicate_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE lower(username) = lower(NEW.username)
      AND user_id <> NEW.user_id
  ) THEN
    RAISE EXCEPTION 'username already taken'
      USING ERRCODE = '23505', CONSTRAINT = 'profiles_username_unique_idx';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_duplicate_username ON public.profiles;
CREATE TRIGGER trg_reject_duplicate_username
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_duplicate_username();

REVOKE ALL ON FUNCTION public.reject_duplicate_username() FROM PUBLIC;
