export function prioridadeParticipanteLouvor(funcoes: readonly string[]) {
  if (funcoes.includes("Ministro")) return 0;
  if (funcoes.includes("Backing Vocal")) return 1;
  return 2;
}

export function hojeEmSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function iso(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

export function periodoDeCultos(referencia: string, visao: "semana" | "mes") {
  const inicio = new Date(`${referencia}T12:00:00`);
  if (visao === "mes") inicio.setDate(1);
  else inicio.setDate(inicio.getDate() - (inicio.getDay() + 6) % 7);
  const fim = new Date(inicio);
  if (visao === "mes") fim.setMonth(fim.getMonth() + 1, 0);
  else fim.setDate(fim.getDate() + 6);
  const curta = (data: Date) => data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return {
    inicio: iso(inicio), fim: iso(fim),
    titulo: visao === "mes" ? inicio.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : `${curta(inicio)} — ${curta(fim)} · ${fim.getFullYear()}`,
  };
}

export function moverPeriodoDeCultos(referencia: string, visao: "semana" | "mes", direcao: number) {
  const data = new Date(`${referencia}T12:00:00`);
  if (visao === "mes") { data.setDate(1); data.setMonth(data.getMonth() + direcao); }
  else data.setDate(data.getDate() + direcao * 7);
  return iso(data);
}
