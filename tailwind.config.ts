import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", ...fontFamily.sans],
        display: ["var(--font-display)", ...fontFamily.sans],
        mono: ["var(--font-mono)", ...fontFamily.mono],
      },

      // The two content columns. Every page picks exactly one via <Container>.
      // Nothing nests a width inside another width, which is what previously
      // left the hero's left edge 80px inside everything below it.
      maxWidth: {
        measure: "44rem",
        page: "64rem",
      },

      spacing: {
        gutter: "clamp(1.25rem, 4vw, 2.5rem)",
        block: "clamp(2.5rem, 6vw, 4.5rem)",
      },

      // Seven steps, fluid, replacing the ~10 ad hoc sizes that were in play.
      // App code uses these names and never a numeric text-* class, so the
      // scale stays the single source of truth for hierarchy.
      fontSize: {
        meta: ["0.8125rem", { lineHeight: "1.4", letterSpacing: "0.02em" }],
        body: ["1rem", { lineHeight: "1.65" }],
        lead: [
          "clamp(1.0625rem, 0.98rem + 0.4vw, 1.1875rem)",
          { lineHeight: "1.55" },
        ],
        title: [
          "clamp(1.25rem, 1.15rem + 0.5vw, 1.5rem)",
          { lineHeight: "1.25", letterSpacing: "-0.01em" },
        ],
        section: [
          "clamp(1.625rem, 1.4rem + 1.1vw, 2.125rem)",
          { lineHeight: "1.15", letterSpacing: "-0.02em" },
        ],
        page: [
          "clamp(2.125rem, 1.7rem + 2.1vw, 3rem)",
          { lineHeight: "1.05", letterSpacing: "-0.03em" },
        ],
        display: [
          "clamp(2.75rem, 1.9rem + 4.2vw, 4.5rem)",
          { lineHeight: "0.98", letterSpacing: "-0.035em" },
        ],
      },

      colors: {
        // Parallel to --accent, deliberately NOT replacing it: shadcn uses
        // --accent for hover backgrounds on every button and tab, so
        // repurposing it would turn every hover state into a colour bomb.
        brand: {
          DEFAULT: "hsl(var(--brand))",
          foreground: "hsl(var(--brand-foreground))",
        },
        // The per-thing colour. Set --thing on a tile or row and everything
        // inside it picks this up. Always a token from the hue set in
        // globals.css, never a free value.
        thing: "hsl(var(--thing, var(--brand)))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;

export default config;
