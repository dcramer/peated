import { testRegion } from "../../e2e/rpc-fixtures.mjs";
import { isTestDataChange } from "./shared-changes.mjs";
import { DESKTOP, MOBILE } from "./viewports.mjs";

export const regionDetailScenario = {
  heading: testRegion.name,
  id: "region-detail",
  label: "Region detail",
  path: `/locations/${testRegion.country.slug}/regions/${testRegion.slug}`,
  shouldRunFor: (filePath) =>
    filePath.startsWith("apps/web/src/app/(app)/locations/") ||
    filePath.startsWith("apps/web/src/components/countryMapIcon/") ||
    filePath.startsWith("apps/web/src/components/usStateMapIcon/") ||
    isTestDataChange(filePath),
  viewports: [DESKTOP, MOBILE],
};
