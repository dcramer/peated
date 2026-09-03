import { customOpenAPIOperation } from "@orpc/openapi";
import { base } from "..";
import type { Context } from "../context";

// The auth middleware owns the OpenAPI authentication requirement so route
// documentation stays aligned with the permission check.
export const requireAuth = customOpenAPIOperation(
  base.$context<Context>().middleware(({ context, next, errors }) => {
    if (!context.user) {
      throw errors.UNAUTHORIZED();
    }
    return next({
      context: {
        ...context,
        user: context.user,
      },
    });
  }),
  { security: [{ bearerAuth: [] }] },
);

export const requireVerified = customOpenAPIOperation(
  base.$context<Context>().middleware(({ context, next, errors }) => {
    if (!context.user?.verified) {
      throw errors.UNAUTHORIZED();
    }
    return next({
      context: {
        ...context,
        user: context.user,
      },
    });
  }),
  { security: [{ bearerAuth: [] }] },
);

// Permission middleware labels staff operations, including routes outside /admin.
// Peated uses its own flag because Scalar hides operations marked x-internal.
export const requireAdmin = customOpenAPIOperation(
  base.$context<Context>().middleware(({ context, next, errors }) => {
    if (!context.user?.admin) {
      throw errors.UNAUTHORIZED();
    }

    return next({
      context: {
        ...context,
        user: context.user,
      },
    });
  }),
  (spec) => ({
    ...spec,
    security: [{ bearerAuth: [] }],
    "x-peated-internal": true,
    "x-badges": [
      { name: "Internal", position: "before" },
      { name: "Admin only", position: "before" },
    ],
  }),
);

export const requireMod = customOpenAPIOperation(
  base.$context<Context>().middleware(({ context, next, errors }) => {
    if (!context.user?.admin && !context.user?.mod) {
      throw errors.UNAUTHORIZED();
    }
    return next({
      context: {
        ...context,
        user: context.user,
      },
    });
  }),
  (spec) => ({
    ...spec,
    security: [{ bearerAuth: [] }],
    "x-peated-internal": true,
    "x-badges": [
      { name: "Internal", position: "before" },
      { name: "Moderator or admin", position: "before" },
    ],
  }),
);

export const requireTosAccepted = customOpenAPIOperation(
  base.$context<Context>().middleware(({ context, next, errors }) => {
    // Explicit auth check for safety (this middleware should always be used with requireAuth)
    if (!context.user) {
      throw errors.UNAUTHORIZED();
    }
    if (!context.user.termsAcceptedAt) {
      throw errors.FORBIDDEN({
        message: "You must accept the Terms of Service to perform this action.",
      });
    }
    return next({
      context: {
        ...context,
        user: context.user,
      },
    });
  }),
  { security: [{ bearerAuth: [] }] },
);
