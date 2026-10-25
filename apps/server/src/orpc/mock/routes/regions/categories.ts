import {
  mockBottles,
  mockCategoriesProducedIn,
  mockCountries,
  mockRegions,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.regions.categories.handler(async ({ input, errors }) => {
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
      (candidate.slug === input.region.toLowerCase() ||
        candidate.id === Number(input.region)),
  );
  if (!region) {
    throw errors.BAD_REQUEST({ message: "Invalid mock region." });
  }

  return mockCategoriesProducedIn(
    mockBottles,
    (distiller) => distiller.region?.id === region.id,
  );
});
