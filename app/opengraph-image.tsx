import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Igreja Ramo da Vida";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#0c2010",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "32px",
          position: "relative",
        }}
      >
        {/* Círculo decorativo de fundo */}
        <div
          style={{
            position: "absolute",
            width: "600px",
            height: "600px",
            borderRadius: "50%",
            background: "radial-gradient(circle, #276f2a33 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Logo SVG branco */}
        <svg
          viewBox="0 0 72 100"
          width="140"
          height="194"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Haste vertical superior */}
          <line x1="36" y1="5" x2="36" y2="38" stroke="white" strokeWidth="4" strokeLinecap="round" />
          {/* Barra horizontal */}
          <line x1="12" y1="38" x2="60" y2="38" stroke="white" strokeWidth="4" strokeLinecap="round" />
          {/* Caule inferior */}
          <line x1="36" y1="38" x2="36" y2="94" stroke="white" strokeWidth="4" strokeLinecap="round" />
          {/* Folha direita 1 */}
          <path d="M36 53 C40 47 56 46 56 54 C56 61 43 60 36 53 Z" fill="white" />
          {/* Folha esquerda 1 */}
          <path d="M36 65 C32 59 16 58 16 66 C16 73 29 72 36 65 Z" fill="white" />
          {/* Folha direita 2 */}
          <path d="M36 78 C40 72 58 71 58 79 C58 86 43 85 36 78 Z" fill="white" />
          {/* Folha esquerda 2 */}
          <path d="M36 90 C32 84 14 83 14 91 C14 98 31 97 36 90 Z" fill="white" />
        </svg>

        {/* Nome da igreja */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              color: "white",
              fontSize: "56px",
              fontWeight: "700",
              letterSpacing: "-1px",
              lineHeight: 1,
            }}
          >
            Igreja Ramo da Vida
          </span>
          <span
            style={{
              color: "#57a85a",
              fontSize: "22px",
              letterSpacing: "4px",
              textTransform: "uppercase",
            }}
          >
            Campinas · SP
          </span>
        </div>

        {/* Versículo */}
        <span
          style={{
            color: "#8bc88d",
            fontSize: "16px",
            fontStyle: "italic",
            letterSpacing: "1px",
          }}
        >
          "Eu sou a videira; vós sois os ramos." — João 15:5
        </span>
      </div>
    ),
    { ...size }
  );
}
