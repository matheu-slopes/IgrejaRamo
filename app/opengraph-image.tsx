import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";
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
