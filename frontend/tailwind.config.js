/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
      },
      borderRadius: {
        card: "10px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.06),0 1px 3px rgba(16,24,40,.10)",
        cardmd: "0 4px 12px rgba(16,24,40,.10)",
        cardlg: "0 12px 40px rgba(16,24,40,.18)",
      },
      keyframes: {
        pop: {
          from: { transform: "translateY(8px) scale(.98)", opacity: "0" },
          to: { transform: "none", opacity: "1" },
        },
      },
      animation: {
        pop: "pop .18s ease",
      },
    },
  },
  plugins: [],
};
