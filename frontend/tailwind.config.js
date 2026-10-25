/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "media", // follows the OS light/dark setting (NFR07)
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff", 100: "#d9eaff", 200: "#bcd9ff", 300: "#8ec1ff", 400: "#599dfb",
          500: "#2563eb", 600: "#1d4ed8", 700: "#1e40af", 800: "#1e3a8a", 900: "#172554",
        },
      },
      fontFamily: {
        // System fonts only: the app must work offline (no web-font download).
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgb(15 23 42 / 0.04), 0 4px 16px rgb(15 23 42 / 0.06)",
        float: "0 8px 30px rgb(15 23 42 / 0.18)",
      },
    },
  },
  plugins: [],
};
