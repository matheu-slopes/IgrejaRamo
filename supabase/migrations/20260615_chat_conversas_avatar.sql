-- Optional custom avatar for chat groups.

ALTER TABLE public.chat_conversas
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
