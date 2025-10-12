import { base } from "..";
import { getConnection } from "../../worker/client";
import type { Context } from "../context";

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix?: string; // Optional prefix for the rate limit key
}

export function createRateLimit(options: RateLimitOptions) {
  const { windowMs, maxRequests, keyPrefix = "rl" } = options;

  return base
    .$context<Context>()
    .middleware(async ({ context, next, errors }) => {
      // Use user ID for authenticated users, IP for anonymous
      const identifier =
        context.user?.id?.toString() || context.ip || "anonymous";
      const key = `${keyPrefix}:${identifier}`;

      const redis = await getConnection();

      // Increment the counter and get the current count
      const count = await redis.incr(key);

      // If this is the first request, set the expiration
      if (count === 1) {
        await redis.pexpire(key, windowMs);
      }

      if (count > maxRequests) {
        throw errors.FORBIDDEN({
          message: "Too many requests. Please try again later.",
        });
      }

      return next({ context });
    });
}

// Preset rate limiters for auth endpoints
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
  keyPrefix: "auth",
});

export const strictAuthRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10, // 10 attempts per hour
  keyPrefix: "auth-strict",
});
