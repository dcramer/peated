/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  ignoredRouteFiles: ["**/.*"],
  appDirectory: "app",
  assetsBuildDirectory: "public/build",
  serverBuildPath: "build/index.js",
  serverDependenciesToBundle: [/^@peated\/.*/],
  serverModuleFormat: "cjs",
  publicPath: "/build/",
  postcss: true,
  tailwind: true,
};
