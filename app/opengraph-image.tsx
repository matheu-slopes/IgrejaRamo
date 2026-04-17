import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const alt = "Igreja Ramo da Vida";
export const size = { width: 600, height: 600 };
export const contentType = "image/png";

export default function Image() {
  const logoData = readFileSync(join(process.cwd(), "public", "logo.png"));
  const logoBase64 = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "600px",
          height: "600px",
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "28px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoBase64}
          width={280}
          height={280}
          alt="logo"
          style={{ objectFit: "contain" }}
        />
        <span
          style={{
            fontSize: "28px",
            fontWeight: "700",
            color: "#1a0a2e",
            fontFamily: "serif",
            letterSpacing: "0.02em",
          }}
        >
          Igreja Ramo da Vida
        </span>
      </div>
    ),
    { ...size }
  );
}

export default function Image() {
  const logoData = readFileSync(join(process.cwd(), "public", "logo.png"));
  const logoBase64 = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "64px",
          padding: "60px 80px",
          fontFamily: "serif",
        }}
      >
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoBase64}
          width={220}
          height={220}
          alt="logo"
          style={{ objectFit: "contain", flexShrink: 0 }}
        />

        {/* Divider */}
        <div
          style={{
            width: "2px",
            height: "220px",
            background: "#d4a012",
            flexShrink: 0,
          }}
        />

        {/* Text */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <span
            style={{
              fontSize: "14px",
              letterSpacing: "0.35em",
              textTransform: "uppercase",
              color: "#d4a012",
              fontFamily: "sans-serif",
            }}
          >
            COMUNIDADE CRISTÃ
          </span>
          <span
            style={{
              fontSize: "56px",
              fontWeight: "700",
              color: "#1a0a2e",
              lineHeight: 1.1,
            }}
          >
            Igreja Ramo{"\n"}da Vida
          </span>
          <span
            style={{
              fontSize: "22px",
              color: "#6b7280",
              fontFamily: "sans-serif",
              marginTop: "8px",
            }}
          >
            Campinas, SP
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
