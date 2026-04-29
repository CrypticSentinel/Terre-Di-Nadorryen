-- ============================================================================
-- FIX RUOLI
-- - Admin resta un ruolo globale
-- - Narratore e Giocatore esistono solo dentro le campagne
-- - Tutti gli utenti hanno il ruolo di campagna predefinito "giocatore"
--   quando vengono inseriti in campaign_members
-- - Solo l'admin può assegnare il ruolo narratore nelle campagne
-- ============================================================================

-- 1) Rimuovi assegnazioni globali non più valide
DELETE FROM public.user_roles
WHERE role::text IN ('giocatore', 'narratore');

-- 2) Crea un nuovo enum globale con il solo ruolo admin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'app_role_new'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.app_role_new AS ENUM ('admin');
  END IF;
END
$$;

-- 3) Converti la colonna user_roles.role al nuovo enum
ALTER TABLE public.user_roles
ALTER COLUMN role TYPE public.app_role_new
USING (
  CASE
    WHEN role::text = 'admin' THEN 'admin'::public.app_role_new
    ELSE NULL
  END
);

-- 4) Sostituisci il vecchio enum app_role
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
ALTER TYPE public.app_role RENAME TO app_role_old;
ALTER TYPE public.app_role_new RENAME TO app_role;

-- 5) Ricrea has_role sul nuovo enum globale
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- 6) Elimina il vecchio enum globale
DROP TYPE public.app_role_old;

-- 7) Rimuovi il trigger di assegnazione automatica dei ruoli globali
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
DROP FUNCTION IF EXISTS public.assign_default_role();

-- 8) Garantisci che il ruolo di campagna resti "giocatore" di default
ALTER TABLE public.campaign_members
ALTER COLUMN role SET DEFAULT 'giocatore'::public.campaign_role;

-- 9) Backfill opzionale e sicuro:
-- tutti gli utenti già presenti senza membership di campagna
-- NON ricevono ruoli globali extra;
-- il ruolo giocatore verrà applicato automaticamente solo quando
-- verranno aggiunti a una campagna, grazie al default di campaign_members.role