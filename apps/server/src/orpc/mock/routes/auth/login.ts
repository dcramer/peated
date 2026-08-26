import { implement } from "@orpc/server";
import { mockAccessToken, mockUser } from "@peated/server/orpc/mock/fixtures";
import login from "@peated/server/orpc/routes/auth/login";

export default implement(login).handler(async () => ({
  user: mockUser,
  accessToken: mockAccessToken,
}));
