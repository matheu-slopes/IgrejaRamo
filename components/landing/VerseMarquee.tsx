"use client";

const verses = [
  { text: "Eu sou o caminho, a verdade e a vida. Ninguém vem ao Pai senão por mim.", ref: "João 14:6" },
  { text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.", ref: "João 3:16" },
  { text: "Eu sou a videira; vós sois os ramos. Quem permanece em mim e eu nele, esse dá muito fruto.", ref: "João 15:5" },
  { text: "O Senhor é o meu pastor e nada me faltará. Ele me faz repousar em pastos verdejantes.", ref: "Salmos 23:1-2" },
];

function Track() {
  return (
    <div className="flex shrink-0" aria-hidden>
      {verses.map((v, i) => (
        <span key={i} className="inline-flex items-center gap-3 px-10 shrink-0">
          <span className="text-gold-500 text-lg select-none">✦</span>
          <span className="font-sans text-vine-800 text-[0.95rem] font-light">{v.text}</span>
          <span className="font-sans text-[11px] tracking-[0.25em] text-vine-500 uppercase ml-1">{v.ref}</span>
        </span>
      ))}
    </div>
  );
}

export default function VerseMarquee() {
  return (
    <div className="relative overflow-hidden py-5 border-y border-vine-200/40">
      <div className="flex whitespace-nowrap" style={{ animation: "marquee-scroll 25s linear infinite", willChange: "transform", backfaceVisibility: "hidden" }}>
        <Track />
        <Track />
      </div>
    </div>
  );
}
