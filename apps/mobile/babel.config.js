/** @type {import("@babel/core").ConfigFunction} */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // must be last per docs
      "react-native-reanimated/plugin",
    ],
  };
};
