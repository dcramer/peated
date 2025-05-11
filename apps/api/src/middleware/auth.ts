import { createMiddleware } from "hono/factory";
import { ForbiddenError, UnauthorizedError } from "http-errors-enhanced";
import type { User } from "../db/schema";
import { getUserFromHeader } from "../lib/auth";

// XXX: this happens globally at the app level and doesnt need to be called
// on each route
/**
 * Middleware to inject user authentication into the request context.
 *
 * This middleware attempts to authenticate the user from the authorization header
 * and injects the user object into the context if successful. Unlike requireAuth,
 * this middleware will not throw an error if authentication fails - it will simply
 * set the user to null.
 *
 * This can be referenced as `c.get("user")` in the route handler.
 *
 * @param c - The context object.
 * @param next - The next middleware function.
 * @returns A promise that resolves to the next middleware function.
 */
export const injectAuth = createMiddleware(async (c, next) => {
  const user = await getUserFromHeader(c.req.header("authorization"));
  c.set("user", user);
  await next();
});

/**
 * Middleware to require a user to be authenticated.
 *
 * If the user is not authenticated, it will throw a 401 Unauthorized error.
 *
 * Define the OpenAPI response schema for the route handler:
 * ```
 * import { unauthorizedSchema } from "http-errors-enhanced";
 *
 * // ...
 * responses: {
 *   401: unauthorizedSchema,
 * }
 * ```
 */
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

/**
 * Middleware to require a user to be authenticated and an admin.
 *
 * If the user is not authenticated this will throw a 401 unauthorized error.
 * If the user is not an admin, it will throw a 403 forbidden error.
 *
 * Define the OpenAPI response schema for the route handler:
 * ```
 * import { forbiddenSchema, unauthorizedSchema } from "http-errors-enhanced";
 *
 * // ...
 * responses: {
 *   401: unauthorizedSchema,
 *   403: forbiddenSchema,
 * }
 * ```
 */
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
    throw new ForbiddenError("Invalid permissions.", {
      name: "no_permission",
    });
  }

  await next();
});

/**
 * Middleware to require a user to be authenticated and a moderator.
 *
 * If the user is not authenticated this will throw a 401 unauthorized error.
 * If the user is not a moderator, it will throw a 403 forbidden error.
 *
 * Define the OpenAPI response schema for the route handler:
 * ```
 * import { forbiddenSchema, unauthorizedSchema } from "http-errors-enhanced";
 *
 * // ...
 * responses: {
 *   401: unauthorizedSchema,
 *   403: forbiddenSchema,
 * }
 * ```
 */
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
      throw new ForbiddenError("Invalid permissions.", {
        name: "no_permission",
      });
    }

    c.set("user", user);

    await next();
  },
);
