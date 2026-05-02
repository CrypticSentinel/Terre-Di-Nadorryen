
-- Add WITH CHECK to characters UPDATE policy to prevent moving rows into other campaigns
DROP POLICY IF EXISTS "Proprietario, narratore o admin modifica scheda" ON public.characters;
CREATE POLICY "Proprietario, narratore o admin modifica scheda"
ON public.characters
FOR UPDATE
TO authenticated
USING (
  (owner_id = auth.uid())
  OR public.is_campaign_narrator(campaign_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  (
    (owner_id = auth.uid() AND public.is_campaign_member(campaign_id, auth.uid()))
    OR public.is_campaign_narrator(campaign_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Add WITH CHECK to session_notes UPDATE policy to prevent reassigning author or moving notes
DROP POLICY IF EXISTS "Autore modifica le proprie note" ON public.session_notes;
CREATE POLICY "Autore modifica le proprie note"
ON public.session_notes
FOR UPDATE
TO authenticated
USING (author_id = auth.uid())
WITH CHECK (
  author_id = auth.uid()
  AND public.can_access_character(character_id, auth.uid())
);
