import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    "client/interceptors": "src/client/interceptors.ts",
    "server/middleware": "src/server/middleware.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
});
