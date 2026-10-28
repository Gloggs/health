/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1280px" },
    },
    screens: {
      // Extra-small breakpoint for narrow phones (380px and up).
      xs: "380px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    // Sharp corners and flat surfaces everywhere (docs/DESIGN.md).
    borderRadius: {
      none: "0", sm: "0", DEFAULT: "0", md: "0", lg: "0", xl: "0", "2xl": "0", "3xl": "0", full: "0",
    },
    boxShadow: {
      sm: "none", DEFAULT: "none", md: "none", lg: "none", xl: "none", "2xl": "none", inner: "none", none: "none",
    },
    extend: {
      // Barlow for text, Barlow Condensed for numbers and headings
      // (docs/DESIGN.md). The serif and mono names are kept as aliases so
      // older markup picks up the new faces until each screen is rebuilt.
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
        handwritten: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      // Fluid type scale (clamp-based) — added in J.4. Avoids the jarring
      // jump from mobile→desktop sizes by interpolating against viewport
      // width. Use these for hero numbers and page titles; standard
      // Tailwind text-* still applies elsewhere.
      //
      // Pattern: clamp(min-rem, base + (vw factor), max-rem)
      // streak  : 72 → 112 px between 375 and 1024 viewport
      // title   : 30 → 40  px
      // subtitle: 14 → 16  px
      fontSize: {
        streak: ["clamp(4.5rem, 2.5rem + 8vw, 7rem)", { lineHeight: "1" }],
        "page-title": ["clamp(1.875rem, 1.25rem + 2vw, 2.5rem)", { lineHeight: "1.1" }],
      },
      // Reusable rhythm constants per BRAND.md §"Spacing rhythm" (added
      // J.4). Tailwind's default 4-unit scale is already 8pt-aligned; this
      // exposes the semantic names so component code reads as intent
      // ("page padding" / "section gap") not literal numbers.
      spacing: {
        "page-x": "1rem",    // 16px (4) — mobile gutter
        "section": "1.5rem", // 24px (6) — between top-level cards
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          soft: "hsl(var(--primary-soft))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        flame: "hsl(var(--flame))",
        harbour: "hsl(var(--harbour))",
        "brand-sky": "hsl(var(--sky))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      keyframes: {
        "fade-in": {
          from: { opacity: 0, transform: "translateY(4px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
