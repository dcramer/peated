import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: {
    jsx: "react-jsx",
  },
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    restoreMocks: true,
  },
});
