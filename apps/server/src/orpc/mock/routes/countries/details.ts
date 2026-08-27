import { mockCountry } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.countries.details.handler(async ({ input, errors }) => {
  if (input.country.toLowerCase() !== mockCountry.slug) {
    throw errors.NOT_FOUND({ message: "Mock country not found." });
  }

  return mockCountry;
});
