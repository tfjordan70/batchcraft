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
          50: "#FDFBF7",
          100: "#FAF6ED",
          200: "#F3EAD6",
          300: "#E8D5B4",
        },
        bark: {
          500: "#8B6914",
          600: "#6B5010",
          700: "#4A380C",
          800: "#2E2208",
          900: "#1A1305",
        },
        sage: {
          400: "#8FAF7E",
          500: "#6D9B58",
          600: "#4E7A3C",
        },
        clay: {
          400: "#C97B5A",
          500: "#B5603C",
          600: "#8F4A2C",
        },
        lye: {
          400: "#6B9DC2",
          500: "#4A7FA8",
          600: "#306080",
        },
      },
      backgroundImage: {
        "texture": "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='4' height='4' fill='%23FAF6ED'/%3E%3Ccircle cx='1' cy='1' r='0.5' fill='%23E8D5B4' opacity='0.5'/%3E%3C/svg%3E\")",
      },
      boxShadow: {
        "warm": "0 4px 24px rgba(139, 105, 20, 0.12)",
        "warm-lg": "0 8px 40px rgba(139, 105, 20, 0.18)",
      },
    },
  },
  plugins: [],
}
