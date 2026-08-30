import { testUser } from "../../e2e/rpc-fixtures.mjs";
import { isSharedPageChange, isTestDataChange } from "./shared-changes.mjs";
import { DESKTOP, MOBILE } from "./viewports.mjs";

export const memberProfileScenario = {
  heading: testUser.username,
  id: "member-profile",
  label: "Member profile",
  path: `/users/${testUser.username}`,
  shouldRunFor: (filePath) =>
    filePath.startsWith("apps/web/src/app/(app)/users/[username]/") ||
    filePath.includes("/memberProfile") ||
    isTestDataChange(filePath) ||
    isSharedPageChange(filePath),
  viewports: [DESKTOP, MOBILE],
};
