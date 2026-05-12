-- ──────────────────────────────────────────────────────────────────────────
-- Tabela para guardar as subscriptions push de cada dispositivo do usuário
-- Rodar no SQL Editor do Supabase (https://supabase.com/dashboard → SQL Editor)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  criado_em  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

-- Índice para busca rápida por user_id
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

-- RLS: apenas o próprio usuário e o service role acessam
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subs_own_select" ON push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "push_subs_own_insert" ON push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subs_own_delete" ON push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "push_subs_own_update" ON push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Service role bypassa RLS automaticamente (usado nas APIs server-side)
