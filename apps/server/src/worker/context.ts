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
    scope.removeAttribute("actor.username");
    return;
  }

  const user: User = { id: String(actor.userId) };
  if (actor.username) user.username = actor.username;
  scope.setUser(user);
  scope.setAttribute("actor.type", actor.type);
  scope.setAttribute("actor.user_id", actor.userId);
  if (actor.username) scope.setAttribute("actor.username", actor.username);
}
