import { ORPCError, os } from "@orpc/server";
import type { Context } from "./context";

export const requireAuth = os
  .$context<Context>()
  .middleware(({ context, next }) => {
    if (!context.user) {
      throw new ORPCError("UNAUTHORIZED");
    }
    return next({
      context: {
        ...context,
        user: context.user,
      },
    });
  });

export const requireVerified = os
  .$context<Context>()
  .middleware(({ context, next }) => {
    if (!context.user?.verified) {
      throw new ORPCError("UNAUTHORIZED");
    }
    return next({
      context: {
        ...context,
        user: context.user,
      },
    });
  });

export const requireAdmin = os
  .$context<Context>()
  .middleware(({ context, next }) => {
    if (!context.user?.admin) {
      throw new ORPCError("UNAUTHORIZED");
    }

    return next({
      context: {
        ...context,
        user: context.user,
      },
    });
  });

export const requireMod = os
  .$context<Context>()
  .middleware(({ context, next }) => {
    if (!context.user?.admin && !context.user?.mod) {
      throw new ORPCError("UNAUTHORIZED");
    }
    return next({
      context: {
        ...context,
        user: context.user,
      },
    });
  });
