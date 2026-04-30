
-- 1. Drop existing groups-based structure (cascades to characters and session_notes via FK chain we'll re-create)
DROP TABLE IF EXISTS public.session_notes CASCADE;
DROP TABLE IF EXISTS public.characters CASCADE;
DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.groups CASCADE;
DROP FUNCTION IF EXISTS public.is_group_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_group_master(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_access_character(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.add_master_as_member() CASCADE;
DROP TYPE IF EXISTS public.group_role CASCADE;

-- 2. App roles enum + user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'narratore', 'giocatore');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 3. Rulesets
CREATE TABLE public.rulesets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rulesets ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_rulesets_updated_at
BEFORE UPDATE ON public.rulesets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Campaigns
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  ruleset_id uuid NOT NULL REFERENCES public.rulesets(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Campaign members (narratore + giocatori per campagna)
CREATE TYPE public.campaign_role AS ENUM ('narratore', 'giocatore');

CREATE TABLE public.campaign_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.campaign_role NOT NULL DEFAULT 'giocatore',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id)
);

-- Vincolo: un solo narratore per campagna
CREATE UNIQUE INDEX idx_one_narrator_per_campaign
ON public.campaign_members (campaign_id)
WHERE role = 'narratore';

ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;

-- Helper functions for campaign access
CREATE OR REPLACE FUNCTION public.is_campaign_member(_campaign_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaign_members
    WHERE campaign_id = _campaign_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_campaign_narrator(_campaign_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaign_members
    WHERE campaign_id = _campaign_id AND user_id = _user_id AND role = 'narratore'
  )
$$;

-- 6. Characters (linked to campaign)
CREATE TABLE public.characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  concept text,
  image_url text,
  custom_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_characters_updated_at
BEFORE UPDATE ON public.characters
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7. Session notes
CREATE TABLE public.session_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  session_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_session_notes_updated_at
BEFORE UPDATE ON public.session_notes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 8. RLS POLICIES

-- user_roles
CREATE POLICY "Utenti vedono i propri ruoli"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admin gestisce ruoli (insert)"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admin gestisce ruoli (update)"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admin gestisce ruoli (delete)"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- rulesets
CREATE POLICY "Tutti vedono i regolamenti"
ON public.rulesets FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Solo admin crea regolamenti"
ON public.rulesets FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admin modifica regolamenti"
ON public.rulesets FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admin elimina regolamenti"
ON public.rulesets FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- campaigns
CREATE POLICY "Tutti vedono le campagne"
ON public.campaigns FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Solo admin crea campagne"
ON public.campaigns FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admin modifica campagne"
ON public.campaigns FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admin elimina campagne"
ON public.campaigns FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- campaign_members
CREATE POLICY "Membri vedono altri membri della campagna"
ON public.campaign_members FOR SELECT TO authenticated
USING (
  public.is_campaign_member(campaign_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Solo admin aggiunge membri"
ON public.campaign_members FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admin modifica membri"
ON public.campaign_members FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admin rimuove membri"
ON public.campaign_members FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- characters
CREATE POLICY "Visione schede"
ON public.characters FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_campaign_narrator(campaign_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Giocatore crea le proprie schede nelle sue campagne"
ON public.characters FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND public.is_campaign_member(campaign_id, auth.uid())
);

CREATE POLICY "Proprietario o admin modifica scheda"
ON public.characters FOR UPDATE TO authenticated
USING (
  owner_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Proprietario o admin elimina scheda"
ON public.characters FOR DELETE TO authenticated
USING (
  owner_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

-- session_notes
CREATE OR REPLACE FUNCTION public.can_access_character(_character_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.characters c
    WHERE c.id = _character_id
      AND (
        c.owner_id = _user_id
        OR public.is_campaign_narrator(c.campaign_id, _user_id)
        OR public.has_role(_user_id, 'admin')
      )
  )
$$;

CREATE POLICY "Visione note"
ON public.session_notes FOR SELECT TO authenticated
USING (public.can_access_character(character_id, auth.uid()));

CREATE POLICY "Crea note se accesso alla scheda"
ON public.session_notes FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND public.can_access_character(character_id, auth.uid())
);

CREATE POLICY "Autore modifica le proprie note"
ON public.session_notes FOR UPDATE TO authenticated
USING (author_id = auth.uid());

CREATE POLICY "Autore elimina le proprie note"
ON public.session_notes FOR DELETE TO authenticated
USING (author_id = auth.uid());

-- 9. Trigger: primo utente diventa admin, gli altri giocatori
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count int;
BEGIN
  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count <= 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'giocatore')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Update handle_new_user to also create profile (already does) - add role assignment via separate trigger
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.assign_default_role();

-- Ensure profile creation trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. Seed dei dati iniziali
INSERT INTO public.rulesets (name, description) VALUES
  ('Terre di Nadorryen', 'Regolamento ufficiale del mondo di Nadorryen.'),
  ('Open Source GDR', 'Regolamento generico e personalizzabile.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.campaigns (name, ruleset_id)
SELECT 'Campagna di Mico', id FROM public.rulesets WHERE name = 'Terre di Nadorryen'
ON CONFLICT DO NOTHING;

INSERT INTO public.campaigns (name, ruleset_id)
SELECT 'Campagna di Marco', id FROM public.rulesets WHERE name = 'Terre di Nadorryen'
ON CONFLICT DO NOTHING;

-- Backfill: assegna admin al primo utente esistente se non c'è ancora un admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT DO NOTHING;

-- Tutti gli altri utenti esistenti ricevono il ruolo giocatore se non hanno alcun ruolo
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'giocatore'::public.app_role
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
ON CONFLICT DO NOTHING;
