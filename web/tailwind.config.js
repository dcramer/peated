/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");

const colors = require("tailwindcss/colors");

module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    colors: {
      ...colors,
      transparent: "transparent",
      current: "currentColor",
      white: "#ffffff",
      black: "#000000",
      peated: {
        light: "#FBBE9D",
        DEFAULT: "#A94007",
        dark: "#5C2102",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter var", ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};
