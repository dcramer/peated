/** Changes to fixed test data affect each page that reads that data. */
export function isTestDataChange(filePath) {
  return (
    filePath === "apps/web/e2e/mock-rpc-server.mjs" ||
    filePath === "apps/web/e2e/rpc-fixtures.mjs"
  );
}

/** Shared UI and web setup changes use a small representative page set. */
export function isSharedPageChange(filePath) {
  // Login has a focused scenario. Keep authentication styles out of the
  // representative page set so the four-page limit cannot hide login.
  const isLoginPattern = filePath.includes(
    "/designSystem/patterns/authentication.stylex",
  );

  return (
    filePath.startsWith("packages/design/") ||
    (filePath.startsWith("apps/web/src/components/designSystem/") &&
      !isLoginPattern) ||
    filePath.startsWith("apps/web/src/styles/") ||
    filePath === "apps/web/src/app/(app)/layout.tsx" ||
    filePath.includes("/defaultLayout") ||
    filePath === "package.json" ||
    filePath === "pnpm-lock.yaml" ||
    filePath === "apps/web/package.json" ||
    filePath === "apps/web/next.config.mjs" ||
    filePath === "apps/web/postcss.config.cjs" ||
    filePath === "apps/web/stylex.config.cjs" ||
    filePath === "apps/web/src/app/layout.tsx" ||
    filePath.startsWith("apps/web/src/app/(app)/_components/application")
  );
}

/** Brand, distillery, and bottler pages share the same page code. */
export function isEntityPageChange(filePath) {
  return (
    filePath.startsWith("apps/web/src/app/(app)/entities/[entityId]/") ||
    filePath.includes("/entityPageHeader")
  );
}
