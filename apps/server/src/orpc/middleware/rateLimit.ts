import { base } from "..";
import type { Context } from "../context";

// Simple in-memory rate limiting store
// In production, this should use Redis or similar
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Cleanup old entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix?: string; // Optional prefix for the rate limit key
}

export function createRateLimit(options: RateLimitOptions) {
  const { windowMs, maxRequests, keyPrefix = "rl" } = options;

  return base.$context<Context>().middleware(({ context, next, errors }) => {
    // Use user ID as the rate limit key (IP would require context extension)
    const identifier = context.user?.id?.toString() || "anonymous";
    const key = `${keyPrefix}:${identifier}`;

    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record || record.resetAt < now) {
      // Start new window
      rateLimitStore.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next({ context });
    }

    if (record.count >= maxRequests) {
      throw errors.FORBIDDEN({
        message: "Too many requests. Please try again later.",
      });
    }

    // Increment count
    record.count++;
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
