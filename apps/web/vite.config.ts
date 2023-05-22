import replace from "@rollup/plugin-replace";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { ManifestOptions, VitePWAOptions } from "vite-plugin-pwa";
import { VitePWA } from "vite-plugin-pwa";
import svgr from "vite-plugin-svgr";

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
    theme_color: "#fbbf24",
    background_color: "#fbbf24",
  },
  devOptions: {
    enabled: process.env.NODE_ENV === "development",
    /* when using generateSW the PWA plugin will switch to classic */
    type: "module",
    navigateFallback: "index.html",
  },
};

const replaceOptions = {
  __DATE__: new Date().toISOString(),
  preventAssignment: true,
};
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

// https://vitejs.dev/config/
export default defineConfig(() => {
  return {
    // TODO(dcramer): for now we're stripping the hash from build files to prevent
    // issues with rolling out the frontend (aka index.html pointing to an old version that doesnt exist).
    // Realistically we need push these assets to a CDN.
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          entryFileNames: `assets/[name].js`,
          chunkFileNames: `assets/[name].js`,
          assetFileNames: `assets/[name].[ext]`,
        },
      },
    },
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
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        // Auth tokens can be obtained from https://sentry.io/settings/account/api/auth-tokens/
        // and need `project:releases` and `org:read` scopes
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: {
          name: process.env.VERSION,
        },
        sourcemaps: {
          assets: "./dist/**",
          deleteFilesAfterUpload: "./dist/**/*.map",
        },
      }),
      replace(replaceOptions),
    ],
  };
});
