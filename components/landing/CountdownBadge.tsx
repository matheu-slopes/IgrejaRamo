"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface Service {
  name: string;
  dayOfWeek: number; // 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
  hour: number;
  minute: number;
}

const SERVICES: Service[] = [
  { name: "Oração",          dayOfWeek: 1, hour: 20, minute: 0  },
  { name: "Culto de Ensino", dayOfWeek: 2, hour: 19, minute: 45 },
  { name: "Culto",           dayOfWeek: 4, hour: 20, minute: 0  },
  { name: "Jovens",          dayOfWeek: 6, hour: 19, minute: 30 },
  { name: "Culto Dominical", dayOfWeek: 0, hour: 18, minute: 30 },
];

function getNextService(): { service: Service; date: Date } | null {
  const now = new Date();
  let nearest: { service: Service; date: Date } | null = null;

  for (const s of SERVICES) {
    const candidate = new Date(now);
    candidate.setHours(s.hour, s.minute, 0, 0);

    let daysUntil = (s.dayOfWeek - now.getDay() + 7) % 7;
    // Se é hoje mas o horário já passou, vai para a próxima semana
    if (daysUntil === 0 && candidate <= now) daysUntil = 7;
    candidate.setDate(now.getDate() + daysUntil);

    if (!nearest || candidate < nearest.date) {
      nearest = { service: s, date: candidate };
    }
  }
  return nearest;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Agora!";
  const totalSec = Math.floor(ms / 1000);
  const d   = Math.floor(totalSec / 86400);
  const h   = Math.floor((totalSec % 86400) / 3600);
  const m   = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;

  return [
    d > 0 ? `${d}d` : null,
    h > 0 ? `${h}h` : null,
    m > 0 ? `${m}m` : null,
    `${String(sec).padStart(2, "0")}s`,
  ]
    .filter(Boolean)
    .join(" ");
}

export default function CountdownBadge() {
  const [label, setLabel]       = useState("");
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    function tick() {
      const next = getNextService();
      if (!next) return;
      setLabel(next.service.name);
      setCountdown(formatCountdown(next.date.getTime() - Date.now()));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!label) return null;

  return (
    <div className="inline-flex items-center gap-2.5 bg-vine-900/70 border border-vine-800/60 backdrop-blur-sm rounded-full px-5 py-2">
      <Clock className="w-3.5 h-3.5 text-gold-400 shrink-0 animate-pulse" />
      <span className="text-vine-400 text-xs">{label} em:</span>
      <span className="font-mono font-bold text-gold-300 text-xs tabular-nums tracking-wider">
        {countdown}
      </span>
    </div>
  );
}
