
DROP POLICY IF EXISTS "Proprietario o admin modifica scheda" ON public.characters;

CREATE POLICY "Proprietario, narratore o admin modifica scheda"
  ON public.characters
  FOR UPDATE
  TO authenticated
  USING (
    (owner_id = auth.uid())
    OR is_campaign_narrator(campaign_id, auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );
