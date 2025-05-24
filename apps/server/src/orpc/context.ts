import type { User } from "@peated/server/db/schema";

export type Context = { user: User | null };
