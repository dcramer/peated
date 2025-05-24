import { os } from "@orpc/server";
import type { User } from "../db/schema";
import { sentryCapture } from "./middleware/sentry";

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
  });

// Base procedure with Sentry error tracking for all routes
export const procedure = base.use(sentryCapture);
