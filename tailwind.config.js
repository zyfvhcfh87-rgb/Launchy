/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgDark: "#08090c",
        bgPanel: "#0f1118",
        bgCard: "#171a25",
        bgCardHover: "#1f2333",
        brandBlue: "#3b82f6",
        brandPurple: "#8b5cf6",
        brandEpic: "#ffffff",
        brandSteam: "#171a25",
        textMuted: "#94a3b8",
        accentGreen: "#10b981",
        accentOrange: "#f59e0b",
        accentRed: "#ef4444",
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 15px rgba(59, 130, 246, 0.5)',
        'glow-green': '0 0 15px rgba(16, 185, 129, 0.5)',
      }
    },
  },
  plugins: [],
}
