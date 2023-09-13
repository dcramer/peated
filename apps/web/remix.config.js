/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  future: {
    v2_errorBoundary: true,
    v2_headers: true,
    v2_meta: true,
    v2_normalizeFormMethod: true,
    v2_routeConvention: true,
    v2_dev: true,
  },
  ignoredRouteFiles: ["**/.*"],
  appDirectory: "app",
  assetsBuildDirectory: "public/build",
  serverBuildPath: "build/index.js",
  serverDependenciesToBundle: [/^@peated\/.*/, "d3", /^d3-*/],
  serverModuleFormat: "cjs",
  publicPath: "/build/",
  postcss: true,
  tailwind: true,
};
