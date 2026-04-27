
-- Estensioni necessarie per il job di pulizia
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ====================================================================
-- TIRI DI DADO CONDIVISI
-- ====================================================================
CREATE TABLE public.dice_rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  character_id UUID,
  character_name TEXT,
  user_id UUID NOT NULL,
  user_display_name TEXT,
  expression TEXT NOT NULL,
  dice JSONB NOT NULL DEFAULT '[]'::jsonb,
  modifier INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_dice_rolls_campaign_created
  ON public.dice_rolls (campaign_id, created_at DESC);

ALTER TABLE public.dice_rolls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membri vedono tiri della campagna"
  ON public.dice_rolls FOR SELECT
  TO authenticated
  USING (
    is_campaign_member(campaign_id, auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Membri creano tiri della campagna"
  ON public.dice_rolls FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      is_campaign_member(campaign_id, auth.uid())
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Autore elimina i propri tiri"
  ON public.dice_rolls FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Realtime: includi la tabella nella publication
ALTER TABLE public.dice_rolls REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dice_rolls;

-- Pulizia automatica via funzione + cron
CREATE OR REPLACE FUNCTION public.purge_old_dice_rolls()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.dice_rolls WHERE created_at < now() - interval '15 days';
$$;

-- Job giornaliero alle 03:15 UTC
SELECT cron.schedule(
  'purge-dice-rolls-15d',
  '15 3 * * *',
  $$ SELECT public.purge_old_dice_rolls(); $$
);

-- ====================================================================
-- AUDIT LOG SCHEDA
-- ====================================================================
CREATE TABLE public.character_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_display_name TEXT,
  summary TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_character_created
  ON public.character_audit_log (character_id, created_at DESC);

ALTER TABLE public.character_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vede audit log chi può accedere alla scheda"
  ON public.character_audit_log FOR SELECT
  TO authenticated
  USING (can_access_character(character_id, auth.uid()));

CREATE POLICY "Inserisce audit chi può accedere alla scheda"
  ON public.character_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND can_access_character(character_id, auth.uid())
  );
