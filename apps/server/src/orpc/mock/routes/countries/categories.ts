import {
  mockBottles,
  mockCategoriesProducedIn,
  mockCountries,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.countries.categories.handler(
  async ({ input, errors }) => {
    const country = mockCountries.find(
      (candidate) =>
        candidate.slug === String(input.country).toLowerCase() ||
        candidate.id === Number(input.country),
    );
    if (!country) {
      throw errors.BAD_REQUEST({ message: "Invalid mock country." });
    }

    return mockCategoriesProducedIn(
      mockBottles,
      (distiller) => distiller.country?.id === country.id,
    );
  },
);
