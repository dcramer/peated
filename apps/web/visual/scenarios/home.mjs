import { isSharedPageChange, isTestDataChange } from "./shared-changes.mjs";
import { DESKTOP, MOBILE } from "./viewports.mjs";

export const homeScenario = {
  heading: "A record of whisky, bottle by bottle.",
  id: "home",
  label: "Home",
  path: "/",
  shouldRunFor: (filePath) =>
    filePath.startsWith("apps/web/src/app/(app)/_components/home/") ||
    filePath === "apps/web/src/app/(app)/homePageClient.tsx" ||
    filePath === "apps/web/src/app/(app)/page.tsx" ||
    isTestDataChange(filePath) ||
    isSharedPageChange(filePath),
  viewports: [DESKTOP, MOBILE],
};
