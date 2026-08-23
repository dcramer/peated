import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { base } from "..";
import { logError } from "../../lib/log";
import { getConnection } from "../../worker/client";
import type { Context } from "../context";

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix?: string; // Optional prefix for the rate limit key
}

export type RateLimitCounter = (
  key: string,
  windowMs: number,
) => Promise<number>;

async function incrementRateLimitCounter(key: string, windowMs: number) {
  const redis = await getConnection();
  const result = await redis.eval(
    `
      local count = redis.call('INCR', KEYS[1])
      if count == 1 then
        redis.call('PEXPIRE', KEYS[1], ARGV[1])
      end
      return count
    `,
    1,
    key,
    windowMs,
  );
  return z.coerce.number().finite().parse(result);
}

/**
 * Builds reusable rate-limit middleware while preserving any route-specific
 * context narrowing applied before this middleware runs.
 */
export function createRateLimit<TContext extends Context = Context>(
  options: RateLimitOptions,
  incrementCounter: RateLimitCounter = incrementRateLimitCounter,
) {
  const { windowMs, maxRequests, keyPrefix = "rl" } = options;

  return base
    .$context<TContext>()
    .middleware(async ({ context, next, errors }) => {
      // Use user ID for authenticated users, IP for anonymous
      const identifier = context.user?.id?.toString() || context.ip;

      // If we can't identify the client, reject the request to prevent rate limit bypass
      if (!identifier) {
        throw errors.FORBIDDEN({
          message: "Unable to process request.",
        });
      }

      const key = `${keyPrefix}:${identifier}`;

      try {
        const count = await incrementCounter(key, windowMs);

        if (count > maxRequests) {
          throw errors.FORBIDDEN({
            message: "Too many requests. Please try again later.",
          });
        }
      } catch (error) {
        if (error instanceof ORPCError) {
          throw error;
        }

        logError(error, {
          extra: {
            keyPrefix,
            maxRequests,
            windowMs,
          },
        });
      }

      return next({ context });
    });
}

// Preset rate limiters for auth endpoints
export function createAuthRateLimit(
  incrementCounter: RateLimitCounter = incrementRateLimitCounter,
) {
  return createRateLimit(
    {
      windowMs: 60 * 60 * 1000, // 60 minutes
      maxRequests: 15, // 15 attempts per hour
      keyPrefix: "auth",
    },
    incrementCounter,
  );
}

export const authRateLimit = createAuthRateLimit();

export const strictAuthRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10, // 10 attempts per hour
  keyPrefix: "auth-strict",
});
