import { mockFlavorProfile } from "@peated/server/orpc/mock/fixtures/flavorProfile";
import {
  mockCountries,
  mockRegions,
} from "@peated/server/orpc/mock/fixtures/places";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.regions.flavorProfile.handler(
  async ({ input, errors }) => {
    const country = mockCountries.find(
      (item) =>
        item.slug === input.country.toLowerCase() ||
        item.id === Number(input.country),
    );
    if (!country) throw errors.NOT_FOUND({ message: "Country not found." });
    const region = mockRegions.find(
      (item) =>
        item.country.id === country.id &&
        (item.slug === input.region.toLowerCase() ||
          item.id === Number(input.region)),
    );
    if (!region) throw errors.NOT_FOUND({ message: "Region not found." });
    return mockFlavorProfile;
  },
);
