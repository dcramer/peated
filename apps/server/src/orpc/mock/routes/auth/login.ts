import { mockAccessToken, mockUser } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.auth.login.handler(async () => ({
  user: mockUser,
  accessToken: mockAccessToken,
}));
