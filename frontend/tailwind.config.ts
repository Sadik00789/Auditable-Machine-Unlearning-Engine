import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0B0F17",
        surface: {
          DEFAULT: "#111827",
          subtle: "#1F2937",
          glass: "rgba(17, 24, 39, 0.75)",
        },
        emerald: {
          neon: "#10B981",
          glow: "rgba(16, 185, 129, 0.25)",
        },
        cyan: {
          neon: "#06B6D4",
          glow: "rgba(6, 182, 212, 0.25)",
        },
        violet: {
          neon: "#8B5CF6",
          glow: "rgba(139, 92, 246, 0.25)",
        },
        rose: {
          neon: "#F43F5E",
          glow: "rgba(244, 63, 94, 0.25)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      boxShadow: {
        "neon-emerald": "0 0 20px rgba(16, 185, 129, 0.35)",
        "neon-cyan": "0 0 20px rgba(6, 182, 212, 0.35)",
        "neon-rose": "0 0 20px rgba(244, 63, 94, 0.35)",
        "neon-violet": "0 0 20px rgba(139, 92, 246, 0.35)",
        "glass": "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-ping": "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
        "radar-scan": "scan 4s linear infinite",
      },
      keyframes: {
        scan: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
