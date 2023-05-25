/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

const colors = require("tailwindcss/colors");

module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    colors: {
      ...colors,
      transparent: "transparent",
      current: "currentColor",
      light: colors.slate[400],
      highlight: {
        DEFAULT: colors.amber[400],
        dark: colors.amber[800],
      },
      background: {
        DEFAULT: "#111111",
        alt: "#1F1F1F",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Raleway", ...defaultTheme.fontFamily.sans],
      },

      animation: {
        fadeIn: "0.5s fadeIn forwards",
        fadeOut: "0.5s fadeOut forwards",
      },

      // that is actual animation
      keyframes: (theme) => ({
        fadeIn: {
          "0%": { opacity: 0, transform: "translate(-20px, 0)" },
          "100%": { opacity: 1, transform: "translate(0, 0)" },
        },
        fadeOut: {
          "0%": { opacity: 1, transform: "translate(0, 0)" },
          "100%": { opacity: 0, transform: "translate(-20px, 0)" },
        },
      }),

      typography: {
        DEFAULT: {
          css: {
            "--tw-prose-body": colors.white,
            "--tw-prose-headings": colors.amber[400],
            "--tw-prose-links": colors.amber[400],
            // "--tw-prose-lead": theme("colors.pink[700]"),
            // "--tw-prose-bold": theme("colors.pink[900]"),
            // "--tw-prose-counters": theme("colors.pink[600]"),
            // "--tw-prose-bullets": theme("colors.pink[400]"),
            // "--tw-prose-hr": theme("colors.pink[300]"),
            // "--tw-prose-quotes": theme("colors.pink[900]"),
            // "--tw-prose-quote-borders": theme("colors.pink[300]"),
            // "--tw-prose-captions": theme("colors.pink[700]"),
            // "--tw-prose-code": theme("colors.pink[900]"),
            // "--tw-prose-pre-code": theme("colors.pink[100]"),
            // "--tw-prose-pre-bg": theme("colors.pink[900]"),
            // "--tw-prose-th-borders": theme("colors.pink[300]"),
            // "--tw-prose-td-borders": theme("colors.pink[200]"),
            // "--tw-prose-invert-body": theme("colors.pink[200]"),
            // "--tw-prose-invert-headings": theme("colors.white"),
            // "--tw-prose-invert-lead": theme("colors.pink[300]"),
            // "--tw-prose-invert-links": theme("colors.white"),
            // "--tw-prose-invert-bold": theme("colors.white"),
            // "--tw-prose-invert-counters": theme("colors.pink[400]"),
            // "--tw-prose-invert-bullets": theme("colors.pink[600]"),
            // "--tw-prose-invert-hr": theme("colors.pink[700]"),
            // "--tw-prose-invert-quotes": theme("colors.pink[100]"),
            // "--tw-prose-invert-quote-borders": theme("colors.pink[700]"),
            // "--tw-prose-invert-captions": theme("colors.pink[400]"),
            // "--tw-prose-invert-code": theme("colors.white"),
            // "--tw-prose-invert-pre-code": theme("colors.pink[300]"),
            // "--tw-prose-invert-pre-bg": "rgb(0 0 0 / 50%)",
            // "--tw-prose-invert-th-borders": theme("colors.pink[600]"),
            // "--tw-prose-invert-td-borders": theme("colors.pink[700]"),
          },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};
