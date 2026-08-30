const path = require("node:path");

function stylexOptions({
  dev = process.env.NODE_ENV !== "production",
  test = false,
} = {}) {
  return {
    dev,
    test,
    runtimeInjection: false,
    enableInlinedConditionalMerge: true,
    treeshakeCompensation: true,
    unstable_moduleResolution: {
      type: "commonJS",
      rootDir: path.resolve(__dirname),
    },
  };
}

module.exports = { stylexOptions };
