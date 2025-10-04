import { os } from "@orpc/server";
import sentryMiddleware from "@peated/orpc/server/middleware";
import type { User } from "../db/schema";

interface ErrorShape {
  // the message should always be a punctuated sentence
  message: string;
  // internal error code if needed
  code?: string;
  // mapped to HTTP status code
  statusCode: number;
  // mapped to HTTP status text
  error: string;
}

export const base = os
  .$context<{
    user: User | null;
    clientIP?: string;
  }>()
  /**
   * All errors should adhere to the ErrorShape interface
   */
  .errors({
    // [string: code]: ErrorShape
    UNAUTHORIZED: {
      message: "Unauthorized.",
      statusCode: 401,
      error: "Unauthorized",
    },
    NOT_FOUND: {
      message: "The resource was not found.",
      statusCode: 404,
      error: "Not Found",
    },
    BAD_REQUEST: {
      message: "Bad Request.",
      statusCode: 400,
      error: "Bad Request",
    },
    FORBIDDEN: {
      message: "Forbidden.",
      statusCode: 403,
      error: "Forbidden",
    },
    INTERNAL_SERVER_ERROR: {
      message: "Internal server error.",
      statusCode: 500,
      error: "Internal Server Error",
    },
    METHOD_NOT_ALLOWED: {
      message: "Method not allowed.",
      statusCode: 405,
      error: "Method Not Allowed",
    },
    CONFLICT: {
      message: "Conflict.",
      statusCode: 409,
      error: "Conflict",
    },
    PAYLOAD_TOO_LARGE: {
      message: "Payload too large.",
      statusCode: 413,
      error: "Payload Too Large",
    },
    UNPROCESSABLE_ENTITY: {
      message: "Unprocessable entity.",
      statusCode: 422,
      error: "Unprocessable Entity",
    },
    TOO_MANY_REQUESTS: {
      message: "Too many requests.",
      statusCode: 429,
      error: "Too Many Requests",
    },
  });

// Base procedure with Sentry error tracking for all routes
// Base procedure with Sentry only; ToS is enforced in UI flows
export const procedure = base.use(sentryMiddleware({ captureInputs: true }));
