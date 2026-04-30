-- Crea enum per stato approvazione
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Aggiungi colonne a profiles
ALTER TABLE public.profiles 
  ADD COLUMN approval_status public.approval_status NOT NULL DEFAULT 'pending',
  ADD COLUMN approved_by uuid,
  ADD COLUMN approved_at timestamptz;

-- Marca tutti gli utenti esistenti come approvati
UPDATE public.profiles SET approval_status = 'approved', approved_at = now();

-- Aggiorna la funzione handle_new_user per gestire l'approvazione
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_count int;
  initial_status public.approval_status;
BEGIN
  SELECT count(*) INTO user_count FROM auth.users;
  -- Il primo utente (admin) viene auto-approvato
  IF user_count <= 1 THEN
    initial_status := 'approved';
  ELSE
    initial_status := 'pending';
  END IF;

  INSERT INTO public.profiles (id, display_name, approval_status, approved_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    initial_status,
    CASE WHEN initial_status = 'approved' THEN now() ELSE NULL END
  );
  RETURN NEW;
END;
$function$;

-- Policy: gli admin possono vedere tutti i profili (già coperto da "Profili leggibili da tutti gli autenticati")
-- Policy: solo gli admin possono aggiornare lo stato di approvazione di altri profili
CREATE POLICY "Admin aggiorna stato approvazione"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Funzione helper per verificare se un utente è approvato
CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND approval_status = 'approved'
  )
$$;