import type { MockOutputs } from "./contract";

// Use this context whenever production behavior depends on the signed-in user.
export type MockContext = {
  user: MockOutputs["auth"]["login"]["user"] | null;
};
