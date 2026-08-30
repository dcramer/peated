const { stylexOptions } = require("./stylex.config.cjs");

module.exports = {
  plugins: {
    "postcss-import": {},
    "@stylexswc/postcss-plugin": {
      include: ["src/**/*.stylex.{js,jsx,ts,tsx}"],
      rsOptions: stylexOptions(),
      useCSSLayers: false,
    },
    autoprefixer: {},
  },
};
