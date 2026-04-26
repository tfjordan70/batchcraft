/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Playfair Display'", "Georgia", "serif"],
        body: ["'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        cream: {
          50: "#FFFFFF",
          100: "#FFFCF5",
          200: "#FFF0D8",
          300: "#F0D5A8",
        },
        bark: {
          500: "#EA580C",
          600: "#C2410C",
          700: "#9A3412",
          800: "#5C2E0F",
          900: "#2C1810",
        },
        sage: {
          400: "#4ADE80",
          500: "#22C55E",
          600: "#15803D",
        },
        clay: {
          400: "#FB923C",
          500: "#EA580C",
          600: "#C2410C",
        },
        lye: {
          400: "#38BDF8",
          500: "#0EA5E9",
          600: "#0369A1",
        },
      },
      backgroundImage: {
        texture:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='4' height='4' fill='%23FFFCF5'/%3E%3Ccircle cx='1' cy='1' r='0.5' fill='%23F0D5A8' opacity='0.45'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        warm: "0 4px 20px rgba(194, 65, 12, 0.18)",
        "warm-lg": "0 10px 40px rgba(194, 65, 12, 0.22)",
      },
    },
  },
  plugins: [],
};
