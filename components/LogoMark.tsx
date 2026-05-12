/**
 * LogoMark – SVG da marca "Igreja Ramo da Vida"
 * Cruz stylizada com ramos/folhas crescendo do caule inferior.
 *
 * Props:
 *  - className  → classes Tailwind aplicadas ao <svg> (width, color, etc.)
 *  - animated   → ativa a animação de "desenhar" o logo via stroke-dashoffset
 */
interface LogoMarkProps {
  className?: string;
  animated?: boolean;
}

export default function LogoMark({
  className = "w-10 h-auto",
  animated = false,
}: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 72 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Ramo da Vida"
    >
      {/* ── Haste vertical superior (acima da barra horizontal) ── */}
      <line
        x1="36"
        y1="5"
        x2="36"
        y2="38"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        className={animated ? "logo-draw-1" : ""}
      />

      {/* ── Barra horizontal (braço da cruz) ── */}
      <line
        x1="12"
        y1="38"
        x2="60"
        y2="38"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        className={animated ? "logo-draw-2" : ""}
      />

      {/* ── Caule/haste inferior (vira ramo) ── */}
      <line
        x1="36"
        y1="38"
        x2="36"
        y2="94"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        className={animated ? "logo-draw-3" : ""}
      />

      {/* ── Folha direita 1 ── */}
      <path
        d="M36 53 C40 47 56 46 56 54 C56 61 43 60 36 53 Z"
        fill="currentColor"
        className={animated ? "logo-leaf-1" : ""}
      />

      {/* ── Folha esquerda 1 ── */}
      <path
        d="M36 65 C32 59 16 58 16 66 C16 73 29 72 36 65 Z"
        fill="currentColor"
        className={animated ? "logo-leaf-2" : ""}
      />

      {/* ── Folha direita 2 ── */}
      <path
        d="M36 78 C40 72 58 71 58 79 C58 86 43 85 36 78 Z"
        fill="currentColor"
        className={animated ? "logo-leaf-3" : ""}
      />

      {/* ── Folha esquerda 2 ── */}
      <path
        d="M36 90 C32 84 14 83 14 91 C14 98 31 97 36 90 Z"
        fill="currentColor"
        className={animated ? "logo-leaf-4" : ""}
      />
    </svg>
  );
}
