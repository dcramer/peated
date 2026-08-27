import {
  mockActivity,
  mockPublicUserDetailsList,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.users.activity.list.handler(
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

    return {
      results: mockActivity
        .filter((entry) => entry.createdBy.id === profile.id)
        .slice(0, input.limit),
      rel: { nextCursor: null, prevCursor: null },
    };
  },
);
