import { implement } from "@orpc/server";
import type { MockContext } from "@peated/server/orpc/mock/context";
import {
  mockBottleDetails,
  mockBottleDetailsFor,
} from "@peated/server/orpc/mock/fixtures";
import details from "@peated/server/orpc/routes/bottles/details";

export default implement(details)
  .$context<MockContext>()
  .handler(async ({ input, context, errors }) => {
    if (input.bottle !== mockBottleDetails.id) {
      throw errors.NOT_FOUND({ message: "Mock bottle not found." });
    }

    return mockBottleDetailsFor(context.user);
  });
