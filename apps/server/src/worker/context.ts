import type { Scope } from "@sentry/core";
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

  scope.setUser({
    id: String(actor.userId),
    ...(actor.username ? { username: actor.username } : {}),
  });
  scope.setAttributes({
    "actor.type": actor.type,
    "actor.user_id": actor.userId,
    ...(actor.username ? { "actor.username": actor.username } : {}),
  });
}
