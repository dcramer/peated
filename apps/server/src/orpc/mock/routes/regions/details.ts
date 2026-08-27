import { mockCountries, mockRegions } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.regions.details.handler(async ({ input, errors }) => {
  const country = mockCountries.find(
    (candidate) =>
      candidate.slug === input.country.toLowerCase() ||
      candidate.id === Number(input.country),
  );
  if (!country) {
    throw errors.BAD_REQUEST({ message: "Invalid mock country." });
  }

  const region = mockRegions.find(
    (candidate) =>
      candidate.country.id === country.id &&
      candidate.slug === input.region.toLowerCase(),
  );
  if (!region) {
    throw errors.NOT_FOUND({ message: "Mock region not found." });
  }

  return region;
});
