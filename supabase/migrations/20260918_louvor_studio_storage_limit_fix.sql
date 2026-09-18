-- The original bucket migration allowed 100 MiB files. HQ lossless WAV stems
-- from a song can be substantially larger, so the worker could finish the
-- separation and fail only during upload.
UPDATE storage.buckets
SET file_size_limit = 536870912,
    allowed_mime_types = ARRAY[
      'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/flac', 'audio/ogg'
    ]
WHERE id = 'louvor-studio';
