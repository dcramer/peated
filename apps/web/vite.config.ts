import { vitePlugin as remix } from "@remix-run/dev";
import autoprefixer from "autoprefixer";
import postcssImport from "postcss-import";
import tailwind from "tailwindcss";
import { defineConfig } from "vite";
import { cjsInterop } from "vite-plugin-cjs-interop";
import svgr from "vite-plugin-svgr";
import tsconfigPaths from "vite-tsconfig-paths";

const MODE = process.env.NODE_ENV;

export default defineConfig({
  build: {
    cssMinify: MODE === "production",
    rollupOptions: {
      external: [/node:.*/, "stream", "crypto", "fsevents"],
    },
  },
  css: {
    postcss: {
      plugins: [postcssImport(), tailwind, autoprefixer],
    },
  },
  plugins: [
    remix({
      // ignoredRouteFiles: ["**/.*"],
      // appDirectory: "app",
      // assetsBuildDirectory: "public/build",
      // serverBuildPath: "build/index.js",
      serverModuleFormat: "cjs",
      // publicPath: "/build/",
    }),
    svgr({
      svgrOptions: {
        plugins: ["@svgr/plugin-svgo", "@svgr/plugin-jsx"],
        svgoConfig: {
          plugins: [
            {
              name: "preset-default",
              params: {
                overrides: {
                  removeViewBox: false,
                },
              },
            },
          ],
        },
      },
    }),
    cjsInterop({
      // List of CJS dependencies that require interop
      dependencies: ["isomorphic-dompurify"],
    }),
    tsconfigPaths(),
  ],
  server: {
    fs: {
      // Restrict files that could be served by Vite's dev server.  Accessing
      // files outside this directory list that aren't imported from an allowed
      // file will result in a 403.  Both directories and files can be provided.
      // If you're comfortable with Vite's dev server making any file within the
      // project root available, you can remove this option.  See more:
      // https://vitejs.dev/config/server-options.html#server-fs-allow
      allow: ["app"],
    },
  },
});
