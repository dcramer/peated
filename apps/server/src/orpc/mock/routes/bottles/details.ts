import { implement } from "@orpc/server";
import { mockBottleDetails } from "@peated/server/orpc/mock/fixtures";
import details from "@peated/server/orpc/routes/bottles/details";

export default implement(details).handler(async ({ input, errors }) => {
  if (input.bottle !== mockBottleDetails.id) {
    throw errors.NOT_FOUND({ message: "Mock bottle not found." });
  }

  return mockBottleDetails;
});
