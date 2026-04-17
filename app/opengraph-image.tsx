import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Igreja Ramo da Vida";
export const size = { width: 600, height: 600 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "600px",
          height: "600px",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Logo SVG preta no centro */}
        <svg
          viewBox="0 0 72 100"
          width="260"
          height="360"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <line x1="36" y1="5" x2="36" y2="38" stroke="#111" strokeWidth="4" strokeLinecap="round" />
          <line x1="12" y1="38" x2="60" y2="38" stroke="#111" strokeWidth="4" strokeLinecap="round" />
          <line x1="36" y1="38" x2="36" y2="94" stroke="#111" strokeWidth="4" strokeLinecap="round" />
          <path d="M36 53 C40 47 56 46 56 54 C56 61 43 60 36 53 Z" fill="#111" />
          <path d="M36 65 C32 59 16 58 16 66 C16 73 29 72 36 65 Z" fill="#111" />
          <path d="M36 78 C40 72 58 71 58 79 C58 86 43 85 36 78 Z" fill="#111" />
          <path d="M36 90 C32 84 14 83 14 91 C14 98 31 97 36 90 Z" fill="#111" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
