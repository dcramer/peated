import {
  existingBottle,
  existingBottleDetails,
} from "../../e2e/rpc-fixtures.mjs";
import { isSharedPageChange, isTestDataChange } from "./shared-changes.mjs";
import { DESKTOP, MOBILE } from "./viewports.mjs";

export const bottleDetailScenario = {
  heading: existingBottleDetails.group.name,
  id: "bottle-detail",
  label: "Bottle detail",
  path: `/bottles/${existingBottle.id}`,
  shouldRunFor: (filePath) =>
    filePath.startsWith("apps/web/src/app/(app)/bottles/[bottleId]/") ||
    filePath.includes("/bottlePage") ||
    filePath.includes("/bottleOverview") ||
    isTestDataChange(filePath) ||
    isSharedPageChange(filePath),
  viewports: [DESKTOP, MOBILE],
};
