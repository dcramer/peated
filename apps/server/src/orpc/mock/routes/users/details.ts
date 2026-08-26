import { implement } from "@orpc/server";
import { mockUserDetails } from "@peated/server/orpc/mock/fixtures";
import details from "@peated/server/orpc/routes/users/details";

export default implement(details).handler(async ({ input, errors }) => {
  const matches =
    input.user === "me" ||
    input.user === mockUserDetails.id ||
    input.user === mockUserDetails.username;

  if (!matches) {
    throw errors.NOT_FOUND({ message: "Mock user not found." });
  }

  return mockUserDetails;
});
