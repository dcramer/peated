// module.exports = {
//     ignoredRouteFiles: ["**/.*"],
//     appDirectory: "app",
//     assetsBuildDirectory: "public/build",
//     serverBuildPath: "build/index.js",
//     serverDependenciesToBundle: [/^@peated\/.*/],
//     serverModuleFormat: "cjs",
//     publicPath: "/build/",
//     postcss: true,
//     tailwind: true,
//   };

import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [remix(), tsconfigPaths()],
});
