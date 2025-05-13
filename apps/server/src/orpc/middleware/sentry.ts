import { os } from "@orpc/server";
import * as Sentry from "@sentry/node";
import type { Context } from "../context";

/**
 * Middleware that automatically captures exceptions in oRPC handlers
 * and reports them to Sentry with proper context.
 */
export const sentryCapture = os
  .$context<Context>()
  .middleware(({ context, next }) => {
    return Sentry.withScope((scope) => {
      try {
        return next({
          context,
        });
      } catch (error) {
        Sentry.captureException(error);

        // Re-throw the error so it can be handled by the error handler
        throw error;
      }
    });
  });
