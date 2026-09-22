import { os } from "@orpc/server";
import type { Context } from "../context";
import { errorDefinitions } from "../contracts/base";

// Suspension rule (moderation): a suspended member can read their own account,
// delete it, and cancel a pending deletion. Every other request is rejected
// with ACCOUNT_SUSPENDED so clients can send the member to the suspension
// screen. The router applies this to every route; see
// docs/architecture/account-access.md.
const SUSPENDED_ALLOWED_PATHS = new Set([
  "auth.me",
  "users.delete",
  "users.deletionCancel",
]);

export const suspensionLockout = os
  .$context<Context>()
  .errors(errorDefinitions)
  .middleware(({ context, next, path, errors }) => {
    if (
      context.user?.suspendedAt &&
      !SUSPENDED_ALLOWED_PATHS.has(path.join("."))
    ) {
      throw errors.ACCOUNT_SUSPENDED();
    }
    return next();
  });
