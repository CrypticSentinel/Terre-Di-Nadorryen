-- Baseline schema consolidato per Terre di Nadorryen
-- Generato consolidando 10 migration in un unico file finale

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =======================
-- ENUMS
-- =======================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'narratore', 'giocatore');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.campaign_role AS ENUM ('narratore', 'giocatore');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =======================
-- CORE FUNCTIONS
-- =======================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_user_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id AND approval_status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_campaign_member(_campaign_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaign_members
    WHERE campaign_id = _campaign_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_campaign_narrator(_campaign_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaign_members
    WHERE campaign_id = _campaign_id AND user_id = _user_id AND role = 'narratore'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_character(_character_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.characters c
    WHERE c.id = _character_id
      AND (
        c.owner_id = _user_id
        OR public.is_campaign_narrator(c.campaign_id, _user_id)
        OR public.has_role(_user_id, 'admin')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.purge_old_dice_rolls()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.dice_rolls
  WHERE created_at < now() - interval '15 days';
$$;

-- =======================
-- TABLES
-- =======================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Avventuriero',
  avatar_url text,
  approval_status public.approval_status NOT NULL DEFAULT 'pending',
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.rulesets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  external_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rulesets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  ruleset_id uuid NOT NULL REFERENCES public.rulesets(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.campaign_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.campaign_role NOT NULL DEFAULT 'giocatore',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id)
);
ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.characters (
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

CREATE TABLE IF NOT EXISTS public.session_notes (
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

CREATE TABLE IF NOT EXISTS public.ui_text_overrides (
  key text PRIMARY KEY,
  text text,
  size integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.ui_text_overrides ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.dice_rolls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  character_name text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_display_name text,
  expression text NOT NULL,
  dice jsonb NOT NULL DEFAULT '[]'::jsonb,
  modifier integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dice_rolls ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.character_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_display_name text,
  summary text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.character_audit_log ENABLE ROW LEVEL SECURITY;

-- =======================
-- INDEXES
-- =======================
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_narrator_per_campaign
ON public.campaign_members (campaign_id)
WHERE role = 'narratore';

CREATE INDEX IF NOT EXISTS idx_dice_rolls_campaign_created
ON public.dice_rolls (campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_character_created
ON public.character_audit_log (character_id, created_at DESC);

-- =======================
-- USER ONBOARDING
-- =======================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count int;
  initial_status public.approval_status;
  initial_role public.app_role;
BEGIN
  SELECT count(*) INTO user_count FROM auth.users;

  IF user_count <= 1 THEN
    initial_status := 'approved';
    initial_role := 'admin';
  ELSE
    initial_status := 'pending';
    initial_role := 'giocatore';
  END IF;

  INSERT INTO public.profiles (id, display_name, approval_status, approved_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    initial_status,
    CASE WHEN initial_status = 'approved' THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, initial_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =======================
-- UPDATED_AT TRIGGERS
-- =======================
DROP TRIGGER IF EXISTS profiles_updated ON public.profiles;
CREATE TRIGGER profiles_updated
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_rulesets_updated_at ON public.rulesets;
CREATE TRIGGER trg_rulesets_updated_at
BEFORE UPDATE ON public.rulesets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER trg_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_characters_updated_at ON public.characters;
CREATE TRIGGER trg_characters_updated_at
BEFORE UPDATE ON public.characters
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_session_notes_updated_at ON public.session_notes;
CREATE TRIGGER trg_session_notes_updated_at
BEFORE UPDATE ON public.session_notes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_ui_text_overrides ON public.ui_text_overrides;
CREATE TRIGGER touch_ui_text_overrides
BEFORE UPDATE ON public.ui_text_overrides
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =======================
-- STORAGE
-- =======================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Avatar pubblicamente visibili" ON storage.objects;
DROP POLICY IF EXISTS "Avatar visibili agli autenticati" ON storage.objects;
DROP POLICY IF EXISTS "Utenti autenticati caricano nei propri file" ON storage.objects;
DROP POLICY IF EXISTS "Utenti aggiornano i propri file" ON storage.objects;
DROP POLICY IF EXISTS "Utenti eliminano i propri file" ON storage.objects;
DROP POLICY IF EXISTS "Avatar letti dagli autenticati" ON storage.objects;
DROP POLICY IF EXISTS "Avatar caricati dal proprietario" ON storage.objects;
DROP POLICY IF EXISTS "Avatar aggiornati dal proprietario" ON storage.objects;
DROP POLICY IF EXISTS "Avatar eliminati dal proprietario" ON storage.objects;

CREATE POLICY "Avatar letti dagli autenticati"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Avatar caricati dal proprietario"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Avatar aggiornati dal proprietario"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Avatar eliminati dal proprietario"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =======================
-- RLS POLICIES
-- =======================
CREATE POLICY "Profili leggibili da tutti gli autenticati"
ON public.profiles FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Aggiorna il proprio profilo"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Inserisci il proprio profilo"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin aggiorna stato approvazione"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Utenti vedono i propri ruoli"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admin gestisce ruoli (insert)"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admin gestisce ruoli (update)"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admin gestisce ruoli (delete)"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Tutti vedono i regolamenti"
ON public.rulesets FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Solo admin crea regolamenti"
ON public.rulesets FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admin modifica regolamenti"
ON public.rulesets FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admin elimina regolamenti"
ON public.rulesets FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Tutti vedono le campagne"
ON public.campaigns FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Solo admin crea campagne"
ON public.campaigns FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admin modifica campagne"
ON public.campaigns FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admin elimina campagne"
ON public.campaigns FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

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
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admin rimuove membri"
ON public.campaign_members FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Visione schede"
ON public.characters FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_campaign_narrator(campaign_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Crea schede (admin o membro)"
ON public.characters FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND (
    public.is_campaign_member(campaign_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Proprietario, narratore o admin modifica scheda"
ON public.characters FOR UPDATE TO authenticated
USING (
  owner_id = auth.uid()
  OR public.is_campaign_narrator(campaign_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  owner_id = auth.uid()
  OR public.is_campaign_narrator(campaign_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Proprietario o admin elimina scheda"
ON public.characters FOR DELETE TO authenticated
USING (
  owner_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

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
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

CREATE POLICY "Autore elimina le proprie note"
ON public.session_notes FOR DELETE TO authenticated
USING (author_id = auth.uid());

CREATE POLICY "Tutti leggono override UI"
ON public.ui_text_overrides FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Solo admin inserisce override UI"
ON public.ui_text_overrides FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admin aggiorna override UI"
ON public.ui_text_overrides FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Solo admin elimina override UI"
ON public.ui_text_overrides FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Membri vedono tiri della campagna"
ON public.dice_rolls FOR SELECT TO authenticated
USING (
  public.is_campaign_member(campaign_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Membri creano tiri della campagna"
ON public.dice_rolls FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    public.is_campaign_member(campaign_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE POLICY "Autore elimina i propri tiri"
ON public.dice_rolls FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Vede audit log chi può accedere alla scheda"
ON public.character_audit_log FOR SELECT TO authenticated
USING (public.can_access_character(character_id, auth.uid()));

CREATE POLICY "Inserisce audit chi può accedere alla scheda"
ON public.character_audit_log FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.can_access_character(character_id, auth.uid())
);

-- =======================
-- REALTIME
-- =======================
ALTER TABLE public.dice_rolls REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dice_rolls;

-- =======================
-- OPTIONAL SEED
-- =======================
INSERT INTO public.rulesets (name, description)
VALUES
  ('Terre di Nadorryen', 'Regolamento ufficiale del mondo di Nadorryen.'),
  ('Open Source GDR', 'Regolamento generico e personalizzabile.')
ON CONFLICT (name) DO NOTHING;

-- =======================
-- OPTIONAL MAINTENANCE JOB
-- =======================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'purge-dice-rolls-15d'
  ) THEN
    PERFORM cron.schedule(
      'purge-dice-rolls-15d',
      '15 3 * * *',
      $$ SELECT public.purge_old_dice_rolls(); $$
    );
  END IF;
END $$;

COMMIT;
