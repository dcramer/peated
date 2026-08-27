import {
  matchesMockUser,
  mockUserFlavorList,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.users.flavorList.handler(
  async ({ input, context, errors }) => {
    if (!matchesMockUser(input.user, context.user)) {
      throw errors.NOT_FOUND({ message: "Mock user not found." });
    }

    return mockUserFlavorList;
  },
);
