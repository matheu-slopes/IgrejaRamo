-- Bootstrap for chat_* tables used by the current app.
-- Safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.chat_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('direto', 'grupo')),
  nome TEXT,
  emoji TEXT,
  cor TEXT,
  descricao TEXT,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  somente_admin BOOLEAN NOT NULL DEFAULT FALSE,
  institucional BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_participantes (
  conversa_id UUID NOT NULL REFERENCES public.chat_conversas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversa_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.chat_mensagens (
  id UUID PRIMARY KEY,
  conversa_id UUID NOT NULL REFERENCES public.chat_conversas(id) ON DELETE CASCADE,
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  autor_nome TEXT NOT NULL,
  conteudo TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto', 'imagem', 'audio', 'documento', 'arquivo')),
  media_url TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  editado_em TIMESTAMPTZ,
  reacoes JSONB DEFAULT '[]'::jsonb,
  resposta_a_id UUID,
  resposta_a_autor_nome TEXT,
  resposta_a_conteudo TEXT
);

CREATE INDEX IF NOT EXISTS idx_chat_participantes_user_conversa
  ON public.chat_participantes (user_id, conversa_id);

CREATE INDEX IF NOT EXISTS idx_chat_mensagens_conversa_criado
  ON public.chat_mensagens (conversa_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_chat_mensagens_criado
  ON public.chat_mensagens (criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_chat_mensagens_conversa_autor
  ON public.chat_mensagens (conversa_id, autor_id);
