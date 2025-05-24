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
