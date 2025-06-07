import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command }) => ({
  server: {
    port: 3000,
  },
  build:
    command === "build"
      ? {
          rollupOptions: {
            input: {
              client: "./src/entry-client.tsx",
              server: "./src/entry-server.tsx",
            },
            output: {
              dir: "dist",
            },
          },
        }
      : {},
  ssr: {
    noExternal: ["@tanstack/react-router"],
  },
  define: {
    // Preserve existing environment variable names for seamless migration
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "development"
    ),
    "process.env.DEBUG": JSON.stringify(process.env.DEBUG || ""),
    "process.env.GOOGLE_CLIENT_ID": JSON.stringify(
      process.env.GOOGLE_CLIENT_ID || ""
    ),
    "process.env.SENTRY_DSN": JSON.stringify(process.env.SENTRY_DSN || ""),
    "process.env.API_SERVER": JSON.stringify(
      process.env.API_SERVER || "http://localhost:4000"
    ),
    "process.env.FATHOM_SITE_ID": JSON.stringify(
      process.env.FATHOM_SITE_ID || ""
    ),
    "process.env.URL_PREFIX": JSON.stringify(
      process.env.URL_PREFIX || "http://localhost:3000"
    ),
    "process.env.VERSION": JSON.stringify(process.env.VERSION || ""),
  },
  plugins: [
    // SVG plugin to transform SVG imports into React components
    svgr({
      include: "**/*.svg",
      svgrOptions: {
        exportType: "default",
      },
    }),
    // Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
      // Specifies the directory TanStack Router uses for your routes.
      routesDirectory: "src/routes", // Defaults to "src/routes"
    }),
    react(),
    tailwindcss(),
    // Enables Vite to resolve imports using path aliases.
    tsconfigPaths(),
  ],
}));
