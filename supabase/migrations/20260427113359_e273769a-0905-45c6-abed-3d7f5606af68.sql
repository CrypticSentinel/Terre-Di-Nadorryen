
-- Tabella per override globali della UI testuale (modificabili solo da admin, lette da tutti)
CREATE TABLE public.ui_text_overrides (
  key TEXT PRIMARY KEY,
  text TEXT,
  size INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.ui_text_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutti leggono override UI"
  ON public.ui_text_overrides FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Solo admin inserisce override UI"
  ON public.ui_text_overrides FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Solo admin aggiorna override UI"
  ON public.ui_text_overrides FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Solo admin elimina override UI"
  ON public.ui_text_overrides FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER touch_ui_text_overrides
  BEFORE UPDATE ON public.ui_text_overrides
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
