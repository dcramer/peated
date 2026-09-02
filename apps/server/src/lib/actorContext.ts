import { AsyncLocalStorage } from "node:async_hooks";

export type ActorContext = {
  type: "user";
  userId: number;
};

const actorContextStorage = new AsyncLocalStorage<ActorContext | undefined>();

/** Convert an authenticated Peated user into the app-owned actor shape. */
export function userToActorContext(
  user: { id: number } | null | undefined,
): ActorContext | undefined {
  if (!user) {
    return undefined;
  }

  return {
    type: "user",
    userId: user.id,
  };
}

/** Run code with app-owned actor context available to nested dispatches. */
export function withActorContext<T>(
  actor: ActorContext | undefined,
  callback: () => Promise<T>,
): Promise<T> {
  return actorContextStorage.run(actor, callback);
}

/** Read the current app-owned actor context. */
export function getCurrentActorContext(): ActorContext | undefined {
  return actorContextStorage.getStore();
}
