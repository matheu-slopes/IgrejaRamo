/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Palheta "Ramo da Vida" ────────────────────────────
        // Inspirada em João 15:5 e na logo (cruz + ramo/oliveira)
        vine: {
          50:  "#f2f8f2",
          100: "#dff0df",
          200: "#bbe1bc",
          300: "#8bc88d",
          400: "#57a85a",
          500: "#368a39",
          600: "#276f2a", // primary action
          700: "#205824",
          800: "#1c471e",
          900: "#193b1b",
          950: "#0c2010",
        },
        // ── Uva — o fruto da videira ──────────────────────────
        // Cristo é a videira, nós os ramos, e o fruto são as uvas
        grape: {
          50:  "#fdf2f8",
          100: "#fce7f4",
          200: "#facfea",
          300: "#f7a8d8",
          400: "#f271bb",
          500: "#e74e9e",
          600: "#d42d81",
          700: "#b01d65",
          800: "#921853",
          900: "#7a1847",
          950: "#500728",
        },
        bark: {
          50:  "#faf6f1",
          100: "#f3ebe0",
          200: "#e5d3bc",
          300: "#d2b490",
          400: "#be9063",
          500: "#b07847",
          600: "#9a633b",
          700: "#7f4f32",
          800: "#69422c",
          900: "#583828",
          950: "#301c13",
        },
        gold: {
          50:  "#fdf9ec",
          100: "#faf0ca",
          200: "#f5df8f",
          300: "#f0c94d",
          400: "#eab624",
          500: "#d49a12",
          600: "#b87b0d",
          700: "#93590e",
          800: "#794612",
          900: "#673b14",
          950: "#3c1e07",
        },
        cream: "#F7F2EA",
        // legacy
        church: {
          gold:  "#c9a94e",
          dark:  "#1a1a2e",
          light: "#f8f5f0",
        },
      },
      fontFamily: {
        sans:  ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      animation: {
        "fade-in":    "fadeIn 0.6s ease forwards",
        "fade-in-up": "fadeInUp 0.6s ease forwards",
        "float":      "float 4s ease-in-out infinite",
        "marquee":    "marquee 30s linear infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: 0 },
          to:   { opacity: 1 },
        },
        fadeInUp: {
          from: { opacity: 0, transform: "translateY(16px)" },
          to:   { opacity: 1, transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-8px)" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to:   { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
};
