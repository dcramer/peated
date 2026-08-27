import { mockCountries } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.countries.details.handler(async ({ input, errors }) => {
  const country = mockCountries.find(
    (candidate) => candidate.slug === input.country.toLowerCase(),
  );
  if (!country) {
    throw errors.NOT_FOUND({ message: "Mock country not found." });
  }

  return country;
});
