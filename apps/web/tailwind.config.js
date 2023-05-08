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
      white: "#ffffff",
      black: "#000000",
      peated: {
        light: "#77c1be",
        DEFAULT: "#005C58",
        dark: "#00423F",
        darker: "#002927",
        darkest: "#000F0F",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Raleway", ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};
