import type { Scope, User } from "@sentry/core";
import type { JobActorContext } from "./types";

/** Apply queued actor attribution to Sentry without using Sentry as storage. */
export function applyJobActorContextToSentry(
  scope: Scope,
  actor: JobActorContext | undefined,
) {
  if (!actor) {
    scope.setUser(null);
    scope.removeAttribute("actor.type");
    scope.removeAttribute("actor.user_id");
    // Remove the legacy attribute from a reused scope.
    scope.removeAttribute("actor.username");
    return;
  }

  const user: User = { id: String(actor.userId) };
  scope.setUser(user);
  scope.setAttribute("actor.type", actor.type);
  scope.setAttribute("actor.user_id", actor.userId);
  scope.removeAttribute("actor.username");
}
