import "server-only";
import { louvorStudioAdmin as db } from "@/lib/louvorStudioServer";
export const uuidValid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
export async function signedPaths(
  paths: Record<string, string>,
  prefix: string,
) {
  const result: Record<string, string> = {};
  await Promise.all(
    Object.entries(paths).map(async ([name, path]) => {
      if (
        typeof path !== "string" ||
        !path.startsWith(prefix + "/") ||
        path.includes("..")
      )
        return;
      const { data, error } = await db.storage
        .from("louvor-studio")
        .createSignedUrl(path, 3600);
      if (error) throw error;
      result[name] = data.signedUrl;
    }),
  );
  return result;
}
export async function signedVersion(
  version: Record<string, unknown>,
  projectId: string,
) {
  const paths = { ...((version.stems as Record<string, string>) ?? {}) };
  if (version.mix_wav) paths.mix_wav = String(version.mix_wav);
  if (version.mix_mp3) paths.mix_mp3 = String(version.mix_mp3);
  const urls =
    version.status === "concluido" ? await signedPaths(paths, projectId) : {};
  const { mix_wav, mix_mp3, ...stem_urls } = urls;
  return {
    id: version.id,
    semitones: version.semitones,
    speed: version.speed,
    status: version.status,
    progresso: version.progresso,
    erro: version.erro,
    stem_urls,
    mix_wav_url: mix_wav,
    mix_mp3_url: mix_mp3,
  };
}
