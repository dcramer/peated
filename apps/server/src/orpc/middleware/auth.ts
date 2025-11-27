import { base } from "..";
import type { Context } from "../context";

export const requireAuth = base
  .$context<Context>()
  .middleware(({ context, next, errors }) => {
    if (!context.user) {
      throw errors.UNAUTHORIZED();
    }
    return next({
      context: {
        ...context,
        user: context.user,
      },
    });
  });

export const requireVerified = base
  .$context<Context>()
  .middleware(({ context, next, errors }) => {
    if (!context.user?.verified) {
      throw errors.UNAUTHORIZED();
    }
    return next({
      context: {
        ...context,
        user: context.user,
      },
    });
  });

export const requireAdmin = base
  .$context<Context>()
  .middleware(({ context, next, errors }) => {
    if (!context.user?.admin) {
      throw errors.UNAUTHORIZED();
    }

    return next({
      context: {
        ...context,
        user: context.user,
      },
    });
  });

export const requireMod = base
  .$context<Context>()
  .middleware(({ context, next, errors }) => {
    if (!context.user?.admin && !context.user?.mod) {
      throw errors.UNAUTHORIZED();
    }
    return next({
      context: {
        ...context,
        user: context.user,
      },
    });
  });

export const requireTosAccepted = base
  .$context<Context>()
  .middleware(({ context, next, errors }) => {
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
  });
