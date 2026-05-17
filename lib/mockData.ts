/**
 * mockData.ts
 * ─────────────────────────────────────────────────────────────────
 * Todos os dados abaixo são FICTÍCIOS para desenvolvimento da UI.
 * Para conectar ao Supabase, substitua cada export pelo resultado
 * das queries correspondentes (ex: supabase.from('users').select()).
 * ─────────────────────────────────────────────────────────────────
 */
import { User, Evento, Aviso, Escala, EscalaMusica, Musica, MuralMensagem, FotoGaleria, Notificacao, CanalMinisterio, MembroMinisterio, ConversaDireta, ChatCulto, Grupo, Local } from "@/types";

export const mockUsers: User[] = [
  {
    id: "1",
    nome: "Pastor João Silva",
    email: "pastor@ramo.church",
    telefone: "(11) 99999-0001",
    role: "pastor",
    ministerios: ["Ensino", "Louvor"],
    dataIngresso: "2018-03-10",
    ativo: true,
  },
  {
    id: "2",
    nome: "Admin",
    email: "admin@ramo.church",
    telefone: "(11) 99999-0002",
    role: "admin",
    ministerios: [],
    dataIngresso: "2019-06-15",
    ativo: true,
  },
  {
    id: "3",
    nome: "Pedro Alves",
    email: "pedro@ramo.church",
    telefone: "(11) 99999-0003",
    role: "lider",
    ministerios: ["Jovens", "Louvor"],
    dataIngresso: "2020-01-20",
    ativo: true,
  },
  {
    id: "8",
    nome: "Matheus Lopes",
    email: "matheus@ramo.church",
    telefone: "(11) 99999-0008",
    role: "lider",
    ministerios: ["Louvor"],
    dataIngresso: "2021-05-10",
    ativo: true,
  },
  {
    id: "4",
    nome: "Ana Rodrigues",
    email: "ana@ramo.church",
    role: "voluntario",
    ministerios: ["Infantil", "Cantina"],
    dataIngresso: "2021-07-05",
    ativo: true,
  },
  {
    id: "5",
    nome: "Lucas Ferreira",
    email: "lucas@ramo.church",
    role: "membro",
    ministerios: ["Ação Social"],
    dataIngresso: "2022-02-14",
    ativo: true,
  },
];

export const mockEventos: Evento[] = [
  {
    id: "e1",
    titulo: "Culto de Celebração",
    descricao: "Culto dominical com louvor e pregação.",
    data: "2026-04-20",
    horario: "10:00",
    local: "Templo Principal",
    publico: true,
    ministerio: "Louvor",
  },
  {
    id: "e2",
    titulo: "Reunião de Jovens",
    descricao: "Encontro semanal da juventude.",
    data: "2026-04-18",
    horario: "19:30",
    local: "Sala 3",
    publico: false,
    ministerio: "Jovens",
  },
  {
    id: "e3",
    titulo: "Ação Social no Bairro",
    descricao: "Distribuição de alimentos e roupas.",
    data: "2026-04-27",
    horario: "09:00",
    local: "Praça Central",
    publico: true,
    ministerio: "Ação Social",
  },
  {
    id: "e4",
    titulo: "Treinamento de Líderes",
    descricao: "Capacitação para líderes de ministério.",
    data: "2026-05-03",
    horario: "14:00",
    local: "Sala de Reuniões",
    publico: false,
    ministerio: "Ensino",
  },
];

export const mockAvisos: Aviso[] = [
  {
    id: "a1",
    titulo: "Reunião Geral de Membros",
    conteudo: "Haverá uma reunião geral no próximo sábado às 16h.",
    criadoEm: "2026-04-14",
    destinatarios: "todos",
  },
  {
    id: "a2",
    titulo: "Coleta Especial — Fundo Social",
    conteudo:
      "Neste domingo haverá coleta especial voltada para o Fundo de Ação Social. Contribua!",
    criadoEm: "2026-04-13",
    destinatarios: "todos",
  },
  {
    id: "a3",
    titulo: "Ensaio do Louvor Remarcado",
    conteudo: "O ensaio de louvor foi remarcado para quinta-feira às 19h.",
    criadoEm: "2026-04-13",
    destinatarios: ["lider", "voluntario"],
    ministerios: ["Louvor"],
  },
  {
    id: "a4",
    titulo: "Relatório Financeiro Disponível",
    conteudo: "O relatório do mês de março está disponível para revisão.",
    criadoEm: "2026-04-10",
    destinatarios: ["admin", "pastor"],
  },
];

// ─── Usuários adicionais ─────────────────────────────────────────
export const mockVoluntariosExtra: User[] = [
  {
    id: "6",
    nome: "Carla Mendes",
    email: "carla@ramo.church",
    role: "voluntario",
    ministerios: ["Louvor"],
    dataIngresso: "2021-03-01",
    ativo: true,
  },
  {
    id: "7",
    nome: "Rafael Souza",
    email: "rafael@ramo.church",
    role: "voluntario",
    ministerios: ["Mídias"],
    dataIngresso: "2022-08-10",
    ativo: true,
  },
];

// ─── Escala do voluntário logado (mock para Pedro — id "3") ─────
export const mockMinhaProximaEscala = {
  data: "Domingo, 19 de Abril",
  horario: "18h30",
  culto: "Culto Domingo 18h30",
  ministerio: "Louvor" as const,
  funcao: "Guitarra no Louvor",
  local: "Templo Principal",
  observacao: "Ensaio às 17h. Confirmar presença com Pedro.",
};

// ─── Escalas ─────────────────────────────────────────────────────
// ─── Repertório de músicas ────────────────────────────────────────────────────
export const mockMusicas: Musica[] = [
  { id: "m1",  titulo: "Hosana",                  artista: "Hillsong",        tom: "G",  estilo: "Contemporâneo" },
  { id: "m2",  titulo: "Reckless Love",            artista: "Cory Asbury PT",  tom: "D",  estilo: "Contemporâneo" },
  { id: "m3",  titulo: "Oceanos",                  artista: "Hillsong PT",     tom: "A",  estilo: "Contemporâneo" },
  { id: "m4",  titulo: "Grande é o Senhor",        artista: "Fernandinho",     tom: "E",  estilo: "Gospel Pop" },
  { id: "m5",  titulo: "É o Senhor",               artista: "Ministério Zoe",  tom: "C",  estilo: "Contemporâneo" },
  { id: "m6",  titulo: "Fogo de Deus",             artista: "Lukas Agustinho", tom: "G",  estilo: "Gospel Pop" },
  { id: "m7",  titulo: "Me Rendo",                 artista: "Ministério Zoe",  tom: "Bb", estilo: "Contemporâneo" },
  { id: "m8",  titulo: "Digno é o Senhor",         artista: "Fernandinho",     tom: "D",  estilo: "Tradicional" },
  { id: "m9",  titulo: "Nada Além do Sangue",      artista: "Ministério Zoe",  tom: "E",  estilo: "Contemporâneo" },
  { id: "m10", titulo: "Teu Santo Nome",           artista: "Fernandinho",     tom: "G",  estilo: "Gospel Pop" },
  { id: "m11", titulo: "Creio",                    artista: "Vineyard Brasil",  tom: "A",  estilo: "Contemporâneo" },
  { id: "m12", titulo: "Quão Grande é o Meu Deus", artista: "Chris Tomlin PT", tom: "C",  estilo: "Tradicional" },
  { id: "m13", titulo: "Bondade de Deus",          artista: "Bethel PT",       tom: "F",  estilo: "Contemporâneo" },
  { id: "m14", titulo: "Ousado Amor",              artista: "Bethel PT",       tom: "D",  estilo: "Contemporâneo" },
  { id: "m15", titulo: "Maranata",                 artista: "Vineyard Brasil",  tom: "G",  estilo: "Contemporâneo" },
];

export const mockEscalas: Escala[] = [
  {
    id: "esc1",
    ministerio: "Louvor",
    data: "2026-04-19",
    horario: "18:30",
    culto: "Culto Domingo 18h30",
    visivel: true,
    confirmacaoParticipantes: true,
    musicas: [
      { musicaId: "m1",  titulo: "Hosana",           artista: "Hillsong",        tom: "G" },
      { musicaId: "m2",  titulo: "Reckless Love",    artista: "Cory Asbury PT",  tom: "D" },
      { musicaId: "m3",  titulo: "Oceanos",           artista: "Hillsong PT",     tom: "A" },
      { musicaId: "m4",  titulo: "Grande é o Senhor", artista: "Fernandinho",    tom: "E" },
    ],
    itens: [
      { funcao: "Ministro",         voluntarioId: "3", voluntarioNome: "Pedro Alves" },
      { funcao: "Guitarra",         voluntarioId: "6", voluntarioNome: "Carla Mendes" },
      { funcao: "Baixo",            voluntarioId: "5", voluntarioNome: "Lucas Ferreira" },
      { funcao: "Bateria",          voluntarioId: "4", voluntarioNome: "Ana Rodrigues", observacao: "Confirmar até sexta" },
      { funcao: "Teclado",          voluntarioId: "1", voluntarioNome: "Pastor João Silva" },
      { funcao: "Backing Vocal",    voluntarioId: "6", voluntarioNome: "Carla Mendes" },
    ],
    criadoPor: "Matheus Lopes",
  },
  {
    id: "esc2",
    ministerio: "Louvor",
    data: "2026-04-17",
    horario: "20:00",
    culto: "Culto de Quinta 20h",
    visivel: true,
    musicas: [
      { musicaId: "m5",  titulo: "É o Senhor",  artista: "Ministério Zoe",  tom: "C" },
      { musicaId: "m6",  titulo: "Fogo de Deus", artista: "Lukas Agustinho", tom: "G" },
      { musicaId: "m7",  titulo: "Me Rendo",    artista: "Ministério Zoe",  tom: "Bb" },
    ],
    itens: [
      { funcao: "Ministro",      voluntarioId: "6", voluntarioNome: "Carla Mendes" },
      { funcao: "Guitarra",      voluntarioId: "3", voluntarioNome: "Pedro Alves" },
      { funcao: "Backing Vocal", voluntarioId: "4", voluntarioNome: "Ana Rodrigues" },
    ],
    criadoPor: "Pedro Alves",
  },
  // ── Mídia — Domingo 19/04
  {
    id: "esc3",
    ministerio: "Mídias",
    data: "2026-04-19",
    horario: "18:30",
    culto: "Culto Domingo 18h30",
    itens: [
      { funcao: "Transmissão",    voluntarioId: "7", voluntarioNome: "Rafael Souza" },
      { funcao: "Projeção/Letras",voluntarioId: "2", voluntarioNome: "Admin" },
      { funcao: "Fotografia",     voluntarioId: "5", voluntarioNome: "Lucas Ferreira", observacao: "Levar tripé" },
    ],
    criadoPor: "Admin",
  },
  // ── Geral — Domingo 19/04
  {
    id: "esc4",
    ministerio: "Cantina",
    data: "2026-04-19",
    horario: "18:30",
    culto: "Culto Domingo 18h30",
    itens: [
      { funcao: "Abertura/Oferta",   voluntarioId: "4", voluntarioNome: "Ana Rodrigues" },
      { funcao: "Escala de Limpeza", voluntarioId: "5", voluntarioNome: "Lucas Ferreira", observacao: "Após o culto" },
    ],
    criadoPor: "Admin",
  },
  // ── Infantil — Domingo 19/04
  {
    id: "esc5",
    ministerio: "Infantil",
    data: "2026-04-19",
    horario: "18:30",
    culto: "Culto Domingo 18h30",
    itens: [
      { funcao: "Professora", voluntarioId: "4", voluntarioNome: "Ana Rodrigues" },
      { funcao: "Monitor",    voluntarioId: "6", voluntarioNome: "Carla Mendes" },
    ],
    criadoPor: "Ana Rodrigues",
  },
];

// ─── Mural interno por ministério ────────────────────────────────
export const mockMuralMensagens: MuralMensagem[] = [
  {
    id: "m1",
    ministerio: "Louvor",
    autorId: "3",
    autorNome: "Pedro Alves",
    autorRole: "lider",
    conteudo: "Galera, ensaio confirmado QUINTA às 19h! Quem não puder, avisar até amanhã 🙏",
    criadoEm: "2026-04-14T10:30:00",
    fixada: true,
    reacoes: [{ emoji: "🙏", count: 5 }, { emoji: "✅", count: 3 }],
  },
  {
    id: "m2",
    ministerio: "Louvor",
    autorId: "6",
    autorNome: "Carla Mendes",
    autorRole: "voluntario",
    conteudo: "Confirmo presença! Vou levar o cabo extra de guitarra também.",
    criadoEm: "2026-04-14T11:00:00",
    fixada: false,
    reacoes: [{ emoji: "👍", count: 2 }],
  },
  {
    id: "m3",
    ministerio: "Louvor",
    autorId: "5",
    autorNome: "Lucas Ferreira",
    autorRole: "voluntario",
    conteudo: "Posso estar lá às 19h sim, mas precisarei sair até às 21h. Ok?",
    criadoEm: "2026-04-14T11:45:00",
    fixada: false,
  },
  {
    id: "m4",
    ministerio: "Louvor",
    autorId: "3",
    autorNome: "Pedro Alves",
    autorRole: "lider",
    conteudo: "Ótimo, sem problema! O setlist do domingo foi atualizado na escala. Confiram lá!",
    criadoEm: "2026-04-14T12:00:00",
    fixada: false,
    reacoes: [{ emoji: "🎸", count: 4 }],
  },
  {
    id: "m5",
    ministerio: "Mídias",
    autorId: "2",
    autorNome: "Admin",
    autorRole: "lider",
    conteudo: "Rafael, lembrar de testar o stream antes do culto de domingo. Chegue às 17h30!",
    criadoEm: "2026-04-13T09:00:00",
    fixada: true,
    reacoes: [{ emoji: "✅", count: 1 }],
  },
  {
    id: "m6",
    ministerio: "Mídias",
    autorId: "7",
    autorNome: "Rafael Souza",
    autorRole: "voluntario",
    conteudo: "Confirmado! Vou chegar no horário e fazer o teste de câmera.",
    criadoEm: "2026-04-13T09:30:00",
    fixada: false,
  },
  {
    id: "m7",
    ministerio: "Infantil",
    autorId: "4",
    autorNome: "Ana Rodrigues",
    autorRole: "lider",
    conteudo: "Material da aula de domingo já está na pasta da sala! Tema: A Pesca Milagrosa 🐟",
    criadoEm: "2026-04-12T08:00:00",
    fixada: true,
    reacoes: [{ emoji: "❤️", count: 3 }, { emoji: "🙌", count: 2 }],
  },
];

// ─── Notificações ────────────────────────────────────────────────
export const mockNotificacoes: Notificacao[] = [
  {
    id: "n1",
    titulo: "Você foi escalado!",
    corpo: "Você está na escala de Louvor no Culto Domingo 18h30 (19/04).",
    tipo: "escala",
    lida: false,
    criadaEm: "2026-04-14T09:00:00",
    link: "/dashboard/escalas",
    ministerio: "Louvor",
  },
  {
    id: "n2",
    titulo: "Novo evento: Ação Social no Bairro",
    corpo: "Ação Social marcada para 27/04 às 09h na Praça Central.",
    tipo: "evento",
    lida: false,
    criadaEm: "2026-04-13T14:00:00",
    link: "/dashboard/eventos",
    ministerio: "Ação Social",
  },
  {
    id: "n3",
    titulo: "Aviso: Reunião Geral",
    corpo: "Haverá uma reunião geral no próximo sábado às 16h. Presença importante!",
    tipo: "aviso",
    lida: false,
    criadaEm: "2026-04-14T08:00:00",
    link: "/dashboard",
  },
  {
    id: "n4",
    titulo: "Canal Louvor: nova mensagem",
    corpo: 'Pedro Alves: "Galera, ensaio confirmado QUINTA às 19h!"',
    tipo: "ministerio",
    lida: true,
    criadaEm: "2026-04-14T10:30:00",
    link: "/dashboard/ministerio/Louvor",
    ministerio: "Louvor",
  },
  {
    id: "n5",
    titulo: "Treinamento de Líderes",
    corpo: "Lembrete: Treinamento de Líderes em 03/05 às 14h na Sala de Reuniões.",
    tipo: "evento",
    lida: true,
    criadaEm: "2026-04-12T10:00:00",
    link: "/dashboard/eventos",
  },
];

// ─── Canais de ministério ─────────────────────────────────────────
export const mockCanais: CanalMinisterio[] = [
  { ministerio: "Louvor",      descricao: "Canal do ministério de louvor e adoração.",         chatBloqueado: false, cor: "grape"  },
  { ministerio: "Mídias",      descricao: "Comunicação e suporte técnico de transmissão.",      chatBloqueado: false, cor: "vine"   },
  { ministerio: "Ensino",      descricao: "Estudos bíblicos e capacitação.",                    chatBloqueado: true,  cor: "bark"   },
  { ministerio: "Infantil",    descricao: "Ministério de crianças e adolescentes.",              chatBloqueado: false, cor: "gold"   },
  { ministerio: "Ação Social", descricao: "Ações de solidariedade e alcance comunitário.",      chatBloqueado: false, cor: "vine"   },
  { ministerio: "Jovens",      descricao: "Movimento jovem da Igreja Ramo da Vida.",            chatBloqueado: false, cor: "grape"  },
  { ministerio: "Cantina", descricao: "Acolhimento, abertura, oferta e recepção no culto.", chatBloqueado: false, cor: "bark"   },
];

// ─── Membros por ministério ───────────────────────────────────────
export const mockMembrosMinisterio: MembroMinisterio[] = [
  // Louvor
  { id: "8",  nome: "Matheus Lopes",    email: "matheus@ramo.church", telefone: "(11) 99999-0008", funcao: "Líder",      ministerio: "Louvor",      ativo: true,  dataEntrada: "2021-05-10" },
  { id: "3",  nome: "Pedro Alves",       email: "pedro@ramo.church",  telefone: "(11) 99999-0003", funcao: "Sub-líder",  ministerio: "Louvor",      ativo: true,  dataEntrada: "2020-01-20" },
  { id: "6",  nome: "Carla Mendes",      email: "carla@ramo.church",                               funcao: "Membro",     ministerio: "Louvor",      ativo: true,  dataEntrada: "2021-03-01" },
  { id: "5",  nome: "Lucas Ferreira",    email: "lucas@ramo.church",                               funcao: "Membro",     ministerio: "Louvor",      ativo: true,  dataEntrada: "2022-02-14" },
  { id: "1",  nome: "Pastor João Silva", email: "pastor@ramo.church", telefone: "(11) 99999-0001", funcao: "Membro",     ministerio: "Louvor",      ativo: true,  dataEntrada: "2018-03-10" },
  // Mídias
  { id: "2",  nome: "Admin", email: "admin@ramo.church",  telefone: "(11) 99999-0002", funcao: "Líder",      ministerio: "Mídias",      ativo: true,  dataEntrada: "2019-06-15" },
  { id: "7",  nome: "Rafael Souza",      email: "rafael@ramo.church",                              funcao: "Membro",     ministerio: "Mídias",      ativo: true,  dataEntrada: "2022-08-10" },
  // Infantil
  { id: "4",  nome: "Ana Rodrigues",     email: "ana@ramo.church",                                funcao: "Líder",      ministerio: "Infantil",    ativo: true,  dataEntrada: "2021-07-05" },
  { id: "6b", nome: "Carla Mendes",      email: "carla@ramo.church",                               funcao: "Membro",     ministerio: "Infantil",    ativo: true,  dataEntrada: "2022-01-10" },
  // Jovens
  { id: "3b", nome: "Pedro Alves",       email: "pedro@ramo.church",  telefone: "(11) 99999-0003", funcao: "Líder",      ministerio: "Jovens",      ativo: true,  dataEntrada: "2020-01-20" },
  { id: "5b", nome: "Lucas Ferreira",    email: "lucas@ramo.church",                               funcao: "Membro",     ministerio: "Jovens",      ativo: true,  dataEntrada: "2022-02-14" },
  // Ação Social
  { id: "5c", nome: "Lucas Ferreira",    email: "lucas@ramo.church",                               funcao: "Líder",      ministerio: "Ação Social", ativo: true,  dataEntrada: "2022-02-14" },
  { id: "4b", nome: "Ana Rodrigues",     email: "ana@ramo.church",                                funcao: "Membro",     ministerio: "Ação Social", ativo: true,  dataEntrada: "2021-07-05" },
  // Recepcionamento
  { id: "4c", nome: "Ana Rodrigues",     email: "ana@ramo.church",                                funcao: "Líder",      ministerio: "Cantina",     ativo: true,  dataEntrada: "2021-07-05" },
  // Ensino
  { id: "1b", nome: "Pastor João Silva", email: "pastor@ramo.church", telefone: "(11) 99999-0001", funcao: "Líder",      ministerio: "Ensino",      ativo: true,  dataEntrada: "2018-03-10" },
];

// ─── Galeria pública ─────────────────────────────────────────────
export const mockGaleria: FotoGaleria[] = [
  {
    id: "g1",
    titulo: "Culto de Celebração",
    url: "https://images.unsplash.com/photo-1519451241324-20b4ea2c4220?w=600&q=80",
    data: "2026-03-30",
  },
  {
    id: "g2",
    titulo: "Ação Social",
    url: "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=600&q=80",
    data: "2026-03-22",
  },
  {
    id: "g3",
    titulo: "Reunião de Jovens",
    url: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80",
    data: "2026-03-15",
  },
  {
    id: "g4",
    titulo: "Louvor",
    url: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=600&q=80",
    data: "2026-03-08",
  },
  {
    id: "g5",
    titulo: "Culto Infantil",
    url: "https://images.unsplash.com/photo-1484820540004-14229fe36ca4?w=600&q=80",
    data: "2026-03-01",
  },
  {
    id: "g6",
    titulo: "Confraternização",
    url: "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=600&q=80",
    data: "2026-02-20",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Locais físicos
// ─────────────────────────────────────────────────────────────────────────────
export const mockLocais: Local[] = [
  { id: "l1", nome: "Templo Principal",  descricao: "Salão principal de cultos" },
  { id: "l2", nome: "Sala 3",            descricao: "Sala de reuniões pequenas" },
  { id: "l3", nome: "Sala de Reuniões",  descricao: "Reuniões de liderança" },
  { id: "l4", nome: "Praça Central",     descricao: "Espaço externo / ação social" },
  { id: "l5", nome: "Salão de Ensaio",   descricao: "Ensaios do louvor e jovens" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Conversas Diretas (DMs)
// ─────────────────────────────────────────────────────────────────────────────
export const mockConversasDiretas: ConversaDireta[] = [
  {
    id: "dm1",
    participantes: ["1", "3"],
    participantesNomes: ["Pastor João Silva", "Pedro Alves"],
    mensagens: [
      {
        id: "dm1m1",
        autorId: "3",
        autorNome: "Pedro Alves",
        conteudo: "Pastor, tudo bem? O setlist de domingo tá confirmado?",
        criadoEm: "2026-04-14T19:00:00",
        lida: true,
      },
      {
        id: "dm1m2",
        autorId: "1",
        autorNome: "Pastor João Silva",
        conteudo: "Tudo bem Pedro! Sim, pode começar com Quão Grande és Tu e depois Bênção de Deus.",
        criadoEm: "2026-04-14T19:12:00",
        lida: true,
      },
      {
        id: "dm1m3",
        autorId: "3",
        autorNome: "Pedro Alves",
        conteudo: "Perfeito! Vou avisar o time. Obrigado 🙏",
        criadoEm: "2026-04-14T19:14:00",
        lida: true,
      },
    ],
  },
  {
    id: "dm2",
    participantes: ["2", "4"],
    participantesNomes: ["Admin", "Ana Rodrigues"],
    mensagens: [
      {
        id: "dm2m1",
        autorId: "2",
        autorNome: "Admin",
        conteudo: "Ana, preciso confirmar: você vai conseguir estar no recepcionamento E no infantil no domingo?",
        criadoEm: "2026-04-15T09:00:00",
        lida: true,
      },
      {
        id: "dm2m2",
        autorId: "4",
        autorNome: "Ana Rodrigues",
        conteudo: "Oi Maria! Sim, consigo. No recepcionamento fico na abertura antes do culto e depois vou pro infantil durante a pregação.",
        criadoEm: "2026-04-15T09:30:00",
        lida: false,
      },
    ],
  },
  {
    id: "dm3",
    participantes: ["1", "4"],
    participantesNomes: ["Pastor João Silva", "Ana Rodrigues"],
    mensagens: [
      {
        id: "dm3m1",
        autorId: "1",
        autorNome: "Pastor João Silva",
        conteudo: "Ana, boa tarde! Tem alguém pra cobrir sua vaga no infantil caso precise?",
        criadoEm: "2026-04-15T14:00:00",
        lida: false,
      },
    ],
  },
];

// ─────────────────────────────────────────────
// Chats de Culto
// ─────────────────────────────────────────────
export const mockChatsCulto: ChatCulto[] = [
  {
    id: "cc1",
    eventoId: "e1",
    titulo: "Culto de Celebração — Domingo 19/04",
    data: "2026-04-19",
    horario: "10:00",
    mensagens: [
      {
        id: "cc1m1",
        autorId: "1",
        autorNome: "Pastor João Silva",
        conteudo: "Bom dia equipe! Que Deus abençoe cada um de nós hoje 🙏 Vamos com tudo!",
        criadoEm: "2026-04-19T08:00:00",
        lida: true,
      },
      {
        id: "cc1m2",
        autorId: "3",
        autorNome: "Pedro Alves",
        conteudo: "Bom dia! Time do louvor vai chegar às 08h30 para o ensaio de passagem, tudo certo!",
        criadoEm: "2026-04-19T08:05:00",
        lida: true,
      },
      {
        id: "cc1m3",
        autorId: "4",
        autorNome: "Ana Rodrigues",
        conteudo: "Recepcionamento aberto às 08h! Café e pão de queijo pra galera 😄",
        criadoEm: "2026-04-19T08:10:00",
        lida: true,
      },
      {
        id: "cc1m4",
        autorId: "2",
        autorNome: "Admin",
        conteudo: "Transmissão ao vivo configurada. Link do YouTube ativo!",
        criadoEm: "2026-04-19T09:00:00",
        lida: false,
      },
    ],
  },
  {
    id: "cc2",
    eventoId: "e2",
    titulo: "Reunião de Jovens — Sexta 17/04",
    data: "2026-04-17",
    horario: "19:30",
    mensagens: [
      {
        id: "cc2m1",
        autorId: "3",
        autorNome: "Pedro Alves",
        conteudo: "Oi pessoal! Confirmados pra hoje? Vamos ter dinâmica especial depois da palavra 🔥",
        criadoEm: "2026-04-17T16:00:00",
        lida: true,
      },
      {
        id: "cc2m2",
        autorId: "5",
        autorNome: "Lucas Ferreira",
        conteudo: "Confirmado! Chego uns 10 minutos antes.",
        criadoEm: "2026-04-17T16:20:00",
        lida: true,
      },
    ],
  },
  {
    id: "cc3",
    titulo: "Culto Quinta-feira — 16/04",
    data: "2026-04-16",
    horario: "20:00",
    mensagens: [
      {
        id: "cc3m1",
        autorId: "1",
        autorNome: "Pastor João Silva",
        conteudo: "Equipe, culto de quinta às 20h. Tema de hoje: Fé que move montanhas. Nos vemos lá!",
        criadoEm: "2026-04-16T10:00:00",
        lida: false,
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Grupos unificados (estilo WhatsApp)
// Tipos: "geral" | "lideranca" | "ministerio" | "culto" | "evento"
// ─────────────────────────────────────────────────────────────────────────────
export const mockGrupos: Grupo[] = [
  // ── Gerais ────────────────────────────────────────────────────────────────
  {
    id: "g_geral",
    nome: "Geral da Igreja",
    tipo: "geral",
    emoji: "🌿",
    cor: "bg-black",
    descricao: "Informações e comunicados para toda a igreja",
    somenteAdmin: false,
    adminId: "2",
    membros: ["1","2","3","4","5","6","7","8"],
    institucional: true,
    mensagens: [
      {
        id: "gg1",
        autorId: "1",
        autorNome: "Pastor João Silva",
        conteudo: "Família Ramo! Reunião geral no sábado às 16h. Presença de todos é importante! 🙏",
        criadoEm: "2026-04-14T08:00:00",
        lida: true,
      },
      {
        id: "gg2",
        autorId: "2",
        autorNome: "Admin",
        conteudo: "Confirmados: culto de domingo começa às 10h00 (1º domingo do mês). Avisem a família!",
        criadoEm: "2026-04-14T09:30:00",
        lida: true,
      },
      {
        id: "gg3",
        autorId: "4",
        autorNome: "Ana Rodrigues",
        conteudo: "Alguém tem contato da Carla? Preciso confirmar o ministrante do infantil 😊",
        criadoEm: "2026-04-15T10:00:00",
        lida: false,
      },
    ],
  },
  {
    id: "g_lideranca",
    nome: "Pastores & Líderes",
    tipo: "lideranca",
    emoji: "👑",
    cor: "bg-grape-800",
    descricao: "Canal exclusivo entre pastores e líderes de ministério",
    somenteAdmin: true,
    adminId: "1",
    membros: ["1","2","3","8"],
    institucional: true,
    mensagens: [
      {
        id: "gl1",
        autorId: "1",
        autorNome: "Pastor João Silva",
        conteudo: "Líderes, reunião de alinhamento toda segunda às 19h (online). Pauta na semana! ✝️",
        criadoEm: "2026-04-13T07:00:00",
        lida: true,
      },
      {
        id: "gl2",
        autorId: "2",
        autorNome: "Admin",
        conteudo: "Relatório de membros do trimestre disponível. Verifiquem os números do ministério de vocês.",
        criadoEm: "2026-04-13T10:00:00",
        lida: true,
      },
      {
        id: "gl3",
        autorId: "1",
        autorNome: "Pastor João Silva",
        conteudo: "Treinamento de líderes confirmado para 03/05. Todos os líderes devem comparecer! 📖",
        criadoEm: "2026-04-15T07:30:00",
        lida: false,
      },
    ],
  },
  // ── Ministérios ───────────────────────────────────────────────────────────
  {
    id: "g_louvor",
    nome: "Louvor",
    tipo: "ministerio",
    emoji: "🎸",
    cor: "bg-grape-700",
    ministerio: "Louvor",
    descricao: "Time de louvor e adoração",
    adminId: "8",
    membros: ["1","3","5","6","8"],
    institucional: true,
    mensagens: [
      {
        id: "glo1",
        autorId: "3",
        autorNome: "Pedro Alves",
        conteudo: "Galera, ensaio QUINTA às 19h confirmado! Quem não puder, avisar até amanhã 🙏",
        criadoEm: "2026-04-14T10:30:00",
        lida: true,
      },
      {
        id: "glo2",
        autorId: "6",
        autorNome: "Carla Mendes",
        conteudo: "Confirmo presença! Vou levar o cabo extra de guitarra.",
        criadoEm: "2026-04-14T11:00:00",
        lida: true,
      },
      {
        id: "glo3",
        autorId: "5",
        autorNome: "Lucas Ferreira",
        conteudo: "Estarei lá, mas saio às 21h, tudo bem?",
        criadoEm: "2026-04-14T11:45:00",
        lida: false,
      },
    ],
  },
  {
    id: "g_midias",
    nome: "Mídias",
    tipo: "ministerio",
    emoji: "📹",
    cor: "bg-black",
    ministerio: "Mídias",
    descricao: "Comunicação e transmissão",
    adminId: "2",
    membros: ["2","7"],
    institucional: true,
    mensagens: [
      {
        id: "gmi1",
        autorId: "2",
        autorNome: "Admin",
        conteudo: "Rafael, chegue às 17h30 para testar a transmissão antes do culto de domingo. ✅",
        criadoEm: "2026-04-13T09:00:00",
        lida: true,
      },
      {
        id: "gmi2",
        autorId: "7",
        autorNome: "Rafael Souza",
        conteudo: "Confirmado! Faço o teste de câmera e stream assim que chegar.",
        criadoEm: "2026-04-13T09:30:00",
        lida: true,
      },
    ],
  },
  {
    id: "g_infantil",
    nome: "Infantil",
    tipo: "ministerio",
    emoji: "🧒",
    cor: "bg-gold-500",
    ministerio: "Infantil",
    descricao: "Ministério de crianças e adolescentes",
    adminId: "4",
    membros: ["4","6"],
    institucional: true,
    mensagens: [
      {
        id: "gin1",
        autorId: "4",
        autorNome: "Ana Rodrigues",
        conteudo: "Material da aula de domingo já está na pasta da sala! Tema: A Pesca Milagrosa 🐟",
        criadoEm: "2026-04-12T08:00:00",
        lida: true,
      },
    ],
  },
  {
    id: "g_acaosocial",
    nome: "Ação Social",
    tipo: "ministerio",
    emoji: "🤝",
    cor: "bg-green-600",
    ministerio: "Ação Social",
    descricao: "Ações de solidariedade e alcance comunitário",
    adminId: "5",
    membros: ["4","5"],
    institucional: true,
    mensagens: [
      {
        id: "gas1",
        autorId: "5",
        autorNome: "Lucas Ferreira",
        conteudo: "Ação do dia 27/04 confirmada! Precisamos de voluntários para ajudar na triagem. Alguém disponível?",
        criadoEm: "2026-04-14T14:00:00",
        lida: false,
      },
    ],
  },
  {
    id: "g_recepcionamento",
    nome: "Recepcionamento",
    tipo: "ministerio",
    emoji: "🍞",
    cor: "bg-amber-700",
    ministerio: "Cantina",
    descricao: "Acolhimento, abertura, oferta e recepção",
    adminId: "4",
    membros: ["4"],
    institucional: true,
    mensagens: [
      {
        id: "gca1",
        autorId: "4",
        autorNome: "Ana Rodrigues",
        conteudo: "Domingo tem café da manhã antes do culto de 10h! Chegarem cedo 😄",
        criadoEm: "2026-04-15T08:00:00",
        lida: false,
      },
    ],
  },
  {
    id: "g_ensino",
    nome: "Ensino",
    tipo: "ministerio",
    emoji: "📖",
    cor: "bg-purple-700",
    ministerio: "Ensino",
    descricao: "Estudos bíblicos e capacitação",
    adminId: "1",
    membros: ["1"],
    institucional: true,
    mensagens: [
      {
        id: "gen1",
        autorId: "1",
        autorNome: "Pastor João Silva",
        conteudo: "Material do estudo de quinta disponível na pasta compartilhada. Leiam antes! 📚",
        criadoEm: "2026-04-13T12:00:00",
        lida: true,
      },
    ],
  },
  // ── Cultos ────────────────────────────────────────────────────────────────
];

