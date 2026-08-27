import type { MockOutputs } from "./contract";

// Mock handlers use this user to match signed-in and signed-out API responses.
export type MockContext = {
  user: MockOutputs["auth"]["login"]["user"] | null;
};
