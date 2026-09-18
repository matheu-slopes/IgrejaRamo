-- Beat-grid phase lets the player align the metronome with the recording,
-- instead of assuming that its first beat occurs at 00:00.000.
ALTER TABLE public.louvor_studio_projetos
  ADD COLUMN IF NOT EXISTS beat_offset_seg numeric(10,3);

-- Target BPMs are converted to a tempo ratio. The previous fixed presets
-- would reject valid whole-number BPM requests at the database boundary.
ALTER TABLE public.louvor_studio_versions
  DROP CONSTRAINT IF EXISTS louvor_studio_versions_speed_check;
ALTER TABLE public.louvor_studio_versions
  ADD CONSTRAINT louvor_studio_versions_speed_check
  CHECK (speed >= 0.5 AND speed <= 1.5);
