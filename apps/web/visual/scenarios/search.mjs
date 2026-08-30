import { isTestDataChange } from "./shared-changes.mjs";
import { DESKTOP, MOBILE } from "./viewports.mjs";

export const searchScenario = {
  heading: "Search the database",
  id: "search",
  label: "Search",
  path: "/search",
  shouldRunFor: (filePath) =>
    filePath.startsWith("apps/web/src/app/(app)/search/") ||
    filePath === "apps/web/src/components/search/search.stylex.tsx" ||
    filePath ===
      "apps/web/src/components/designSystem/components/searchBox.stylex.tsx" ||
    filePath ===
      "apps/web/src/components/designSystem/components/searchResults.stylex.tsx" ||
    isTestDataChange(filePath),
  viewports: [DESKTOP, MOBILE],
};
