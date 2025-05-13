import { os } from "@orpc/server";
import type { User } from "../db/schema";
import { sentryCapture } from "./middleware/sentry";

// Base procedure with Sentry error tracking for all routes
export const procedure = os
  .$context<{
    user: User | null;
  }>()
  .use(sentryCapture);
