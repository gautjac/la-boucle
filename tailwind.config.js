/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // La Boucle — a studio/DAW console. Deep charcoal, neon waveform, warm steel.
        rack: {
          DEFAULT: "#0c0e10", // deepest charcoal (page)
          panel: "#15181c", // panel surface
          raised: "#1d2127", // raised control
          line: "#2a2f37", // hairlines / borders
          deep: "#070809", // wells / cutouts
        },
        // neon waveform accents
        lime: {
          DEFAULT: "#c6ff3f",
          dim: "#8fb02c",
          glow: "#e4ff8f",
        },
        cyan: {
          DEFAULT: "#22e3d6",
          dim: "#16998f",
        },
        // loop region highlight
        ember: "#ff7849",
        steel: {
          DEFAULT: "#8b94a3", // muted labels
          dim: "#5d6675",
          bright: "#c7cdd6",
        },
      },
      fontFamily: {
        sans: ['"Sora"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.8)",
        well: "0 2px 8px -2px rgba(0,0,0,0.9) inset",
        glow: "0 0 18px -2px rgba(198,255,63,0.35)",
        "glow-cyan": "0 0 18px -2px rgba(34,227,214,0.4)",
      },
      keyframes: {
        riseIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        sweep: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        riseIn: "riseIn 0.35s ease-out both",
        pulseGlow: "pulseGlow 1.4s ease-in-out infinite",
        sweep: "sweep 1.2s linear infinite",
      },
    },
  },
  plugins: [],
};
