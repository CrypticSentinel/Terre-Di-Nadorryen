
-- Permetti agli admin di creare schede in qualsiasi campagna (anche se non membri)
DROP POLICY IF EXISTS "Giocatore crea le proprie schede nelle sue campagne" ON public.characters;

CREATE POLICY "Crea schede (admin o membro)"
ON public.characters
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND (
    public.is_campaign_member(campaign_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);
