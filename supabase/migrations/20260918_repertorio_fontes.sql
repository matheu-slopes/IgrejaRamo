-- Metadados permanentes importados da fonte de cifra. O tom/BPM do culto
-- continuam exclusivamente em escala_musicas.
ALTER TABLE public.musicas
  ADD COLUMN IF NOT EXISTS tom TEXT,
  ADD COLUMN IF NOT EXISTS link_youtube TEXT,
  ADD COLUMN IF NOT EXISTS cifra TEXT,
  ADD COLUMN IF NOT EXISTS cifra_url TEXT,
  ADD COLUMN IF NOT EXISTS cifra_artista_slug TEXT,
  ADD COLUMN IF NOT EXISTS cifra_musica_slug TEXT;
