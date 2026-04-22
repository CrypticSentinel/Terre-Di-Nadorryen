
-- Fix search_path warning
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Restringi listing del bucket: rendiamo il bucket non public,
-- gli URL firmati/pubblici rimangono accessibili tramite getPublicUrl perche'
-- la policy SELECT consente la lettura dei singoli oggetti via URL.
-- In realta' per bucket pubblici la lettura singola passa per la policy SELECT
-- gia' definita; il warning riguarda la possibilita' di listare. Lo risolviamo
-- mantenendo public=true ma cambiando approccio: lasciamo SELECT a chiunque
-- (necessario per servire le immagini), e accettiamo il warning come noto.
-- In alternativa sicura: restringere SELECT solo agli autenticati.
DROP POLICY IF EXISTS "Avatar pubblicamente visibili" ON storage.objects;
CREATE POLICY "Avatar visibili agli autenticati"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

-- Rendi il bucket non pubblico (richiederemo URL firmati lato client)
UPDATE storage.buckets SET public = false WHERE id = 'avatars';
