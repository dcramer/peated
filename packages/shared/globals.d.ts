import type { User } from "@peated/core/db/schema";
import "vitest";

declare global {
  export const DefaultFixtures: {
    user: User;
    authHeaders: {
      Authorization: string;
    };
  };
}
