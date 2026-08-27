import {
  mockUserDetails,
  mockUserDetailsFor,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.users.details.handler(
  async ({ input, context, errors }) => {
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
  },
);
