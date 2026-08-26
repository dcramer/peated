import type { Outputs } from "@peated/server/orpc/router";

export type MockContext = {
  user: Outputs["auth"]["login"]["user"] | null;
};
