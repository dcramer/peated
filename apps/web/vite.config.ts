import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import type { ManifestOptions, VitePWAOptions } from "vite-plugin-pwa";
import replace from "@rollup/plugin-replace";
import { VitePWA } from "vite-plugin-pwa";

const pwaOptions: Partial<VitePWAOptions> = {
  registerType: "autoUpdate",
  base: "/",
  includeAssets: ["*.png"],
  manifest: {
    short_name: "Peated",
    name: "Peated",
    description: "Is it Peated?",
    icons: [
      {
        src: "glyph.png",
        sizes: "64x64 32x32 24x24 16x16",
        type: "image/png",
      },
      {
        src: "logo192.png",
        type: "image/png",
        sizes: "192x192",
      },
      {
        src: "logo512.png",
        type: "image/png",
        sizes: "512x512",
      },
    ],
    display: "standalone",
    theme_color: "#005C58",
    background_color: "#005C58",
  },
  devOptions: {
    enabled: process.env.NODE_ENV === "development",
    /* when using generateSW the PWA plugin will switch to classic */
    type: "module",
    navigateFallback: "index.html",
  },
};

const replaceOptions = { __DATE__: new Date().toISOString() };
const claims = process.env.CLAIMS === "true";
const reload = process.env.RELOAD_SW === "true";
const selfDestroying = process.env.SW_DESTROY === "true";

if (process.env.SW === "true") {
  pwaOptions.srcDir = "src";
  pwaOptions.filename = claims
    ? "service-worker/claims-sw.ts"
    : "service-worker/prompt-sw.ts";
  pwaOptions.strategies = "injectManifest";
  (pwaOptions.manifest as Partial<ManifestOptions>).name =
    "PWA Inject Manifest";
  (pwaOptions.manifest as Partial<ManifestOptions>).short_name = "PWA Inject";
}

if (claims) pwaOptions.registerType = "autoUpdate";

if (reload) {
  // @ts-expect-error just ignore
  replaceOptions.__RELOAD_SW__ = "true";
}

if (selfDestroying) pwaOptions.selfDestroying = selfDestroying;

const ALLOWED_ENV = ["SENTRY_DSN", "GOOGLE_CLIENT_ID", "API_SERVER", "VERSION"];

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), "");

  const processEnvValues = {
    "process.env": Object.entries(env)
      .filter(([k]) => ALLOWED_ENV.indexOf(k))
      .reduce((prev, [key, val]) => {
        return {
          ...prev,
          [key]: val,
        };
      }, {}),
  };

  return {
    // TODO(dcramer): for now we're stripping the hash from build files to prevent
    // issues with rolling out the frontend (aka index.html pointing to an old version that doesnt exist).
    // Realistically we need push these assets to a CDN.
    build: {
      rollupOptions: {
        output: {
          entryFileNames: `assets/[name].js`,
          chunkFileNames: `assets/[name].js`,
          assetFileNames: `assets/[name].[ext]`,
        },
      },
    },
    define: processEnvValues,
    plugins: [
      react(),
      VitePWA(pwaOptions),
      svgr({
        // Set it to `true` to export React component as default.
        // Notice that it will overrides the default behavior of Vite.
        exportAsDefault: false,

        // svgr options: https://react-svgr.com/docs/options/
        svgrOptions: {
          // ...
        },

        // esbuild options, to transform jsx to js
        esbuildOptions: {
          // ...
        },

        //  A minimatch pattern, or array of patterns, which specifies the files in the build the plugin should include. By default all svg files will be included.
        include: "**/*.svg",

        //  A minimatch pattern, or array of patterns, which specifies the files in the build the plugin should ignore. By default no files are ignored.
        exclude: "",
      }),
      // https://github.com/getsentry/sentry-javascript/issues/8059
      // sentryVitePlugin({
      //   org: env.SENTRY_ORG,
      //   project: env.SENTRY_PROJECT,

      //   // Auth tokens can be obtained from https://sentry.io/settings/account/api/auth-tokens/
      //   // and need `project:releases` and `org:read` scopes
      //   authToken: env.SENTRY_AUTH_TOKEN,

      //   release: env.VERSION,

      //   sourcemaps: {
      //     // Specify the directory containing build artifacts
      //     assets: "./dist/**",
      //   },
      // }),
      replace(replaceOptions),
    ],
  };
});
