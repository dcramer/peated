import { os } from "@orpc/server";
import type { User } from "../db/schema";

export const procedure = os.$context<{
  user: User | null;
}>();
