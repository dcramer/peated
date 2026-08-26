import { oc } from "@orpc/contract";

export const errorDefinitions = {
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
} as const;

export const contract = oc.errors(errorDefinitions);
