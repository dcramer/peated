import { isSharedPageChange, isTestDataChange } from "./shared-changes.mjs";
import { DESKTOP, MOBILE } from "./viewports.mjs";

export const addTastingScenario = {
  heading: "Log a tasting",
  id: "add-tasting",
  label: "Log a tasting",
  path: "/addBottle?intent=tasting",
  shouldRunFor: (filePath) =>
    filePath.startsWith("apps/web/src/app/(layout-free)/addBottle/") ||
    filePath.includes("/bottleResolver/") ||
    filePath.includes("/tastingForm") ||
    filePath.includes("/workflowScreen") ||
    isTestDataChange(filePath) ||
    isSharedPageChange(filePath),
  signedIn: true,
  viewports: [DESKTOP, MOBILE],
};
