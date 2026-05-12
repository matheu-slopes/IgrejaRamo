/**
 * calendarUtils.ts
 * ─────────────────────────────────────────────────────────────────
 * Utilitários para integração com calendários externos.
 *
 * Suporte:
 *  - Arquivo .ics → Google Calendar, Apple Calendar, Outlook,
 *    qualquer app de calendário no celular ou notebook
 *  - Link direto Google Calendar (abre no navegador/app)
 * ─────────────────────────────────────────────────────────────────
 */

import { Evento } from "@/types";

/**
 * Formata uma data+hora para o formato iCalendar: YYYYMMDDTHHMMSS
 */
function formatICSDate(isoDate: string, hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  const date = new Date(isoDate + "T00:00:00");
  date.setHours(h, m, 0, 0);

  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}${month}${day}T${hours}${minutes}00`;
}

/**
 * Escapa caracteres especiais no formato iCalendar
 */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Gera o conteúdo de um arquivo .ics para o evento.
 * O arquivo pode ser baixado e aberto em qualquer app de calendário.
 */
export function gerarICS(evento: Evento): string {
  const dtStart = formatICSDate(evento.data, evento.horario);
  // Duração padrão: 2 horas
  const [h, m] = evento.horario.split(":").map(Number);
  const endDate = new Date(evento.data + "T00:00:00");
  endDate.setHours(h + 2, m, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dtEnd = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;

  const uid = `${evento.id}-${Date.now()}@ramo.church`;
  const descricao = [evento.descricao, evento.ministerio ? `Ministério: ${evento.ministerio}` : ""].filter(Boolean).join("\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Igreja Ramo da Vida//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatICSDate(new Date().toISOString().split("T")[0], "00:00")}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICS(evento.titulo)}`,
    `DESCRIPTION:${escapeICS(descricao)}`,
    `LOCATION:${escapeICS(evento.local)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * Faz o download do arquivo .ics no navegador do usuário.
 * Funciona em desktop (Windows/Mac/Linux) e no celular via WebView.
 * No celular, o sistema operacional pergunta com qual app de calendário abrir.
 */
export function downloadICS(evento: Evento): void {
  const conteudo = gerarICS(evento);
  const blob = new Blob([conteudo], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${evento.titulo.replace(/\s+/g, "_")}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Gera um link para adicionar o evento diretamente ao Google Calendar.
 * Abre na aba do navegador; no celular abre o app do Google Calendar se instalado.
 */
export function linkGoogleCalendar(evento: Evento): string {
  const dtStart = formatICSDate(evento.data, evento.horario);
  const [h, m] = evento.horario.split(":").map(Number);
  const endDate = new Date(evento.data + "T00:00:00");
  endDate.setHours(h + 2, m, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dtEnd = `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}T${pad(endDate.getHours())}${pad(endDate.getMinutes())}00`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: evento.titulo,
    dates: `${dtStart}/${dtEnd}`,
    details: `${evento.descricao}${evento.ministerio ? `\n\nMinistério: ${evento.ministerio}` : ""}`,
    location: evento.local,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Formata uma data ISO (2026-04-20) para exibição (20 abr 2026)
 */
export function formatarData(isoDate: string): string {
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${day} ${meses[month - 1]} ${year}`;
}

/**
 * Formata dia da semana em português
 */
export function diaSemana(isoDate: string): string {
  const dias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const date = new Date(isoDate + "T12:00:00");
  return dias[date.getDay()];
}
