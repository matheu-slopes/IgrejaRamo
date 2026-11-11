export type EquipeMembro = { usuarioId: string; funcao: string };
export type EquipeMinisterio = { id: string; ministerio: string; nome: string; membros: EquipeMembro[] };
