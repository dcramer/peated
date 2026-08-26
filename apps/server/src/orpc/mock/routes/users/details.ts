import { implement } from "@orpc/server";
import type { MockContext } from "@peated/server/orpc/mock/context";
import {
  mockUserDetails,
  mockUserDetailsFor,
} from "@peated/server/orpc/mock/fixtures";
import details from "@peated/server/orpc/routes/users/details";

export default implement(details)
  .$context<MockContext>()
  .handler(async ({ input, context, errors }) => {
    if (input.user === "me" && !context.user) {
      throw errors.UNAUTHORIZED();
    }

    const matches =
      input.user === "me" ||
      input.user === mockUserDetails.id ||
      input.user === mockUserDetails.username;

    if (!matches) {
      throw errors.NOT_FOUND({ message: "Mock user not found." });
    }

    return mockUserDetailsFor(context.user);
  });
