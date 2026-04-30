
-- =======================
-- ENUM ruolo nel gruppo
-- =======================
CREATE TYPE public.group_role AS ENUM ('master', 'player');

-- =======================
-- PROFILES
-- =======================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Avventuriero',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profili leggibili da tutti gli autenticati"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Aggiorna il proprio profilo"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Inserisci il proprio profilo"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Trigger: crea profilo automaticamente alla registrazione
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =======================
-- GROUPS
-- =======================
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  master_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER groups_updated BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =======================
-- GROUP MEMBERS
-- =======================
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.group_role NOT NULL DEFAULT 'player',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Funzione di sicurezza: l'utente è membro del gruppo?
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id
  );
$$;

-- Funzione di sicurezza: l'utente è master del gruppo?
CREATE OR REPLACE FUNCTION public.is_group_master(_group_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups
    WHERE id = _group_id AND master_id = _user_id
  );
$$;

-- Policies groups
CREATE POLICY "Membri vedono i loro gruppi"
  ON public.groups FOR SELECT TO authenticated
  USING (public.is_group_member(id, auth.uid()) OR master_id = auth.uid());
CREATE POLICY "Chiunque autenticato puo' creare un gruppo"
  ON public.groups FOR INSERT TO authenticated WITH CHECK (master_id = auth.uid());
CREATE POLICY "Solo master modifica il gruppo"
  ON public.groups FOR UPDATE TO authenticated USING (master_id = auth.uid());
CREATE POLICY "Solo master elimina il gruppo"
  ON public.groups FOR DELETE TO authenticated USING (master_id = auth.uid());

-- Policies group_members
CREATE POLICY "Membri vedono altri membri dello stesso gruppo"
  ON public.group_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Utente puo' iscriversi a un gruppo"
  ON public.group_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Utente puo' uscire dal gruppo o master rimuove"
  ON public.group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_group_master(group_id, auth.uid()));

-- Trigger: master diventa automaticamente membro alla creazione del gruppo
CREATE OR REPLACE FUNCTION public.add_master_as_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.master_id, 'master');
  RETURN NEW;
END;
$$;
CREATE TRIGGER groups_add_master AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.add_master_as_member();

-- =======================
-- CHARACTERS (schede)
-- =======================
CREATE TABLE public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  concept TEXT,
  image_url TEXT,
  custom_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER characters_updated BEFORE UPDATE ON public.characters
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Membri del gruppo vedono le schede"
  ON public.characters FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Membri del gruppo creano schede proprie"
  ON public.characters FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));
CREATE POLICY "Proprietario o master modifica scheda"
  ON public.characters FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_group_master(group_id, auth.uid()));
CREATE POLICY "Proprietario o master elimina scheda"
  ON public.characters FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_group_master(group_id, auth.uid()));

-- =======================
-- SESSION NOTES (diario)
-- =======================
CREATE TABLE public.session_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  session_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER session_notes_updated BEFORE UPDATE ON public.session_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Funzione: utente puo' accedere a una scheda?
CREATE OR REPLACE FUNCTION public.can_access_character(_character_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.characters c
    WHERE c.id = _character_id
      AND public.is_group_member(c.group_id, _user_id)
  );
$$;

CREATE POLICY "Membri vedono le note delle schede del gruppo"
  ON public.session_notes FOR SELECT TO authenticated
  USING (public.can_access_character(character_id, auth.uid()));
CREATE POLICY "Membri creano note sulle schede del proprio gruppo"
  ON public.session_notes FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.can_access_character(character_id, auth.uid()));
CREATE POLICY "Autore modifica le proprie note"
  ON public.session_notes FOR UPDATE TO authenticated USING (author_id = auth.uid());
CREATE POLICY "Autore elimina le proprie note"
  ON public.session_notes FOR DELETE TO authenticated USING (author_id = auth.uid());

-- =======================
-- STORAGE bucket avatars (pubblico)
-- =======================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

CREATE POLICY "Avatar pubblicamente visibili"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
CREATE POLICY "Utenti autenticati caricano nei propri file"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Utenti aggiornano i propri file"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Utenti eliminano i propri file"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
