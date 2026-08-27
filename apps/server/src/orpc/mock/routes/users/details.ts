import {
  mockPublicUserDetailsList,
  mockUserDetailsFor,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.users.details.handler(
  async ({ input, context, errors }) => {
    if (input.user === "me" && !context.user) {
      throw errors.UNAUTHORIZED();
    }

    const profile =
      input.user === "me"
        ? mockPublicUserDetailsList.find(
            (candidate) => candidate.id === context.user?.id,
          )
        : mockPublicUserDetailsList.find(
            (candidate) =>
              candidate.id === input.user || candidate.username === input.user,
          );
    if (!profile) {
      throw errors.NOT_FOUND({ message: "Mock user not found." });
    }

    return mockUserDetailsFor(context.user, profile);
  },
);
