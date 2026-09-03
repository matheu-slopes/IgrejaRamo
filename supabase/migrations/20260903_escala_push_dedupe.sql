CREATE TABLE IF NOT EXISTS public.escala_push_entregas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escala_id UUID NOT NULL REFERENCES public.escalas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('vespera', 'hoje', 'resumo_lider')),
  referencia DATE NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (escala_id, usuario_id, tipo, referencia)
);
CREATE INDEX IF NOT EXISTS idx_escala_push_entregas_referencia ON public.escala_push_entregas (referencia, tipo);
ALTER TABLE public.escala_push_entregas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.escala_push_entregas FROM anon, authenticated;
