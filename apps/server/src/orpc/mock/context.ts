import type { Outputs } from "@peated/server/orpc/router";

// Use this context whenever production behavior depends on the signed-in user.
export type MockContext = {
  user: Outputs["auth"]["login"]["user"] | null;
};
