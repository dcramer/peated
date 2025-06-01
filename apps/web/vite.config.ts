import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    rollupOptions: {
      // Tell Rollup to NOT bundle these Node.js modules for the browser
      external: ["node:stream", "node:stream/web", "node:async_hooks"],
    },
  },
  ssr: {
    // Make sure TanStack Start server modules are handled correctly
    noExternal: ["@tanstack/react-start"],
  },
  plugins: [
    tailwindcss(),
    // Enables Vite to resolve imports using path aliases.
    tsconfigPaths(),
    tanstackStart({
      tsr: {
        verboseFileRoutes: true,
        // Specifies the directory TanStack Router uses for your routes.
        routesDirectory: "src/routes", // Defaults to "src/routes"
      },
    }),
  ],
});
