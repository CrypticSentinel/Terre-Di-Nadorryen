-- Modifica mirata dei ruoli: Admin globale, Giocatore globale di default, Narratore solo di campagna

BEGIN;

-- 1) Estende il ruolo globale includendo solo i ruoli richiesti a livello app
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'giocatore';

-- 2) Rimuove eventuali assegnazioni globali non valide: narratore non deve esistere globalmente
DELETE FROM public.user_roles
WHERE role::text = 'narratore';

-- 3) Tutti gli utenti presenti devono avere il ruolo globale giocatore
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'giocatore'::public.app_role
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_roles ur
  WHERE ur.user_id = u.id
    AND ur.role = 'giocatore'::public.app_role
)
ON CONFLICT (user_id, role) DO NOTHING;

-- 4) Solo l'admin già esistente resta admin; nessuna nuova assegnazione automatica admin
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'giocatore'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMIT;
