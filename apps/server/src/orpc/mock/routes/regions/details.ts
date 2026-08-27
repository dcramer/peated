import { mockCountry, mockRegion } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.regions.details.handler(async ({ input, errors }) => {
  const countryMatches =
    input.country.toLowerCase() === mockCountry.slug ||
    Number(input.country) === mockCountry.id;
  if (!countryMatches) {
    throw errors.BAD_REQUEST({ message: "Invalid mock country." });
  }

  if (input.region.toLowerCase() !== mockRegion.slug) {
    throw errors.NOT_FOUND({ message: "Mock region not found." });
  }

  return mockRegion;
});
