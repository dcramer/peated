import { createMiddleware } from "hono/factory";
import { ForbiddenError, UnauthorizedError } from "http-errors-enhanced";
import type { User } from "../db/schema";
import { getUserFromHeader } from "../lib/auth";

// XXX: this happens globally at the app level
export const injectAuth = createMiddleware(async (c, next) => {
  const user = await getUserFromHeader(c.req.header("authorization"));
  c.set("user", user);
  await next();
});

export const requireAuth = createMiddleware<{ Variables: { user: User } }>(
  async (c, next) => {
    let user: User | null | undefined = c.get("user");
    if (user === undefined) {
      user = await getUserFromHeader(c.req.header("authorization"));
    }

    if (!user) {
      const auth = c.req.header("authorization");
      const token = auth?.replace("Bearer ", "");

      throw new UnauthorizedError(token ? "Invalid token." : undefined, {
        name: token ? "invalid_token" : "auth_required",
      });
    }

    c.set("user", user);

    await next();
  },
);

export const requireAdmin = createMiddleware<{
  Variables: {
    user: User;
  };
}>(async (c, next) => {
  let user: User | null | undefined = c.get("user");
  if (user === undefined) {
    user = await getUserFromHeader(c.req.header("authorization"));
  }

  if (!user) {
    const auth = c.req.header("authorization");
    const token = auth?.replace("Bearer ", "");

    throw new UnauthorizedError(token ? "Invalid token." : undefined, {
      name: token ? "invalid_token" : "auth_required",
    });
  }

  c.set("user", user);

  if (!user.admin) {
    throw new ForbiddenError("Unauthorized", {
      name: "no_permission",
    });
  }

  await next();
});

export const requireMod = createMiddleware<{ Variables: { user: User } }>(
  async (c, next) => {
    let user: User | null | undefined = c.get("user");
    if (user === undefined) {
      user = await getUserFromHeader(c.req.header("authorization"));
    }

    if (!user) {
      const auth = c.req.header("authorization");
      const token = auth?.replace("Bearer ", "");

      throw new UnauthorizedError(token ? "Invalid token." : undefined, {
        name: token ? "invalid_token" : "auth_required",
      });
    }

    if (!user.mod && !user.admin) {
      throw new ForbiddenError("Unauthorized", {
        name: "no_permission",
      });
    }

    c.set("user", user);

    await next();
  },
);
