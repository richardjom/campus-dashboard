import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f7f7f4",
        ink: "#111827",
        line: "#e5e7eb",
        accent: {
          DEFAULT: "#0f766e",
          soft: "#ccfbf1",
        },
      },
      boxShadow: {
        none: "none",
      },
    },
  },
  plugins: [],
} satisfies Config;
