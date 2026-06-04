import type { Ministerio, User } from "@/types";

export function sameMinisterio(a: string, b: string) {
  return a.trim().toLocaleLowerCase("pt-BR") === b.trim().toLocaleLowerCase("pt-BR");
}

export function userMinisterios(user: User | null | undefined): Ministerio[] {
  const merged = [...(user?.ministerios ?? []), ...(user?.liderMinisterios ?? [])];
  return merged.reduce<Ministerio[]>((acc, ministerio) => {
    if (!acc.some((item) => sameMinisterio(item, ministerio))) {
      acc.push(ministerio);
    }
    return acc;
  }, []);
}

export function isUserInMinisterio(user: User | null | undefined, ministerio: string) {
  return userMinisterios(user).some((item) => sameMinisterio(item, ministerio));
}
