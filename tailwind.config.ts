import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f5f0e8",
        "bg-paper": "#ebe6dc",
        fg: "#111111",
        "fg-muted": "#6b6560",
        "fg-light": "#9a9590",
        redact: "#111111",
        accent: "#c0392b",
        cleared: "#1a7a3a",
        border: "#d5cfc5",
        "border-dark": "#b0a99e",
      },
      fontFamily: {
        serif: ["DM Serif Display", "Georgia", "serif"],
        sans: ["Inter", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Courier New", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "load-slide": "loadSlide 1.5s ease-in-out infinite",
      },
      keyframes: {
        loadSlide: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(350%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
