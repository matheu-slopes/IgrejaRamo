export const NOTES = [
  { value: "C", label: "Dó" },
  { value: "C#", label: "Dó♯ / Ré♭" },
  { value: "D", label: "Ré" },
  { value: "D#", label: "Ré♯ / Mi♭" },
  { value: "E", label: "Mi" },
  { value: "F", label: "Fá" },
  { value: "F#", label: "Fá♯ / Sol♭" },
  { value: "G", label: "Sol" },
  { value: "G#", label: "Sol♯ / Lá♭" },
  { value: "A", label: "Lá" },
  { value: "A#", label: "Lá♯ / Si♭" },
  { value: "B", label: "Si" },
];
export type Direction = "auto" | "up" | "down";
export type SeparationMode = "bs_roformer" | "htdemucs_ft";
export const QUALITY_VERSION = "r3-stereo-v1";
export function parseKey(value: string) {
  const match = /^([A-G])([#b]?)(m?)$/.exec(value);
  if (!match) throw new Error("Selecione uma tonalidade válida.");
  const natural: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  return {
    note:
      (natural[match[1]] +
        (match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0) +
        12) %
      12,
    minor: match[3] === "m",
  };
}
export function transposeSemitones(
  original: string,
  target: string,
  direction: Direction = "auto",
) {
  const from = parseKey(original),
    to = parseKey(target);
  if (from.minor !== to.minor)
    throw new Error(
      "A transposição preserva maior/menor. Mudar o modo exige reharmonização.",
    );
  if (!["auto", "up", "down"].includes(direction))
    throw new Error("Direção inválida.");
  const up = (to.note - from.note + 12) % 12;
  return direction === "up"
    ? up
    : direction === "down"
      ? up
        ? up - 12
        : 0
      : up > 6
        ? up - 12
        : up;
}
export function keyAt(original: string, semitones: number) {
  const parsed = parseKey(original);
  return (
    NOTES[(parsed.note + semitones + 24) % 12].value + (parsed.minor ? "m" : "")
  );
}
export function stemNames(mode: string) {
  return mode === "bs_roformer"
    ? ["vocals", "instrumental"]
    : ["vocals", "drums", "bass", "other"];
}
