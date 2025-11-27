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

      // Atomically increment and set expiration if this is the first request
      // This Lua script prevents race conditions
      const lua = `
        local count = redis.call('INCR', KEYS[1])
        if count == 1 then
          redis.call('PEXPIRE', KEYS[1], ARGV[1])
        end
        return count
      `;
      const count = (await redis.eval(lua, 1, key, windowMs)) as number;

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
  windowMs: 60 * 60 * 1000, // 60 minutes
  maxRequests: 15, // 15 attempts per hour
  keyPrefix: "auth",
});

export const strictAuthRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10, // 10 attempts per hour
  keyPrefix: "auth-strict",
});
