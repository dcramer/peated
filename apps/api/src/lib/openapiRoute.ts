import { OpenAPIHono } from "@hono/zod-openapi";
import type { ZodTypeAny } from "zod";
import { z } from "zod";
import { ConflictErrorSchema, UnauthorizedErrorSchema } from "./errorSchemas";

// Types for request schemas
export type RouteRequestSchemas = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
};

// Types for response schemas
export type RouteResponseSchemas = {
  [status: number]: {
    schema: ZodTypeAny;
    description: string;
  };
};

// Config type for the route helper
export type DefineRouteConfig = {
  method: "get" | "post" | "put" | "delete";
  path: string;
  request?: RouteRequestSchemas;
  responses: RouteResponseSchemas;
  tags?: string[];
  summary?: string;
  description?: string;
  middleware?: any[];
  handler: (c: any, req: { body?: any; query?: any }) => Promise<any>;
  // ...other options as needed
};

// Default error responses
const defaultResponses: RouteResponseSchemas = {
  401: { schema: UnauthorizedErrorSchema, description: "Unauthorized" },
  409: { schema: ConflictErrorSchema, description: "Conflict" },
};

export function defineRoute(config: DefineRouteConfig) {
  // Merge default responses, allow override by user
  const responses: RouteResponseSchemas = {
    ...defaultResponses,
    ...config.responses,
  };

  // Build OpenAPI responses object
  const openapiResponses: any = {};
  for (const [status, { schema, description }] of Object.entries(responses)) {
    openapiResponses[status] = {
      content: {
        "application/json": { schema },
      },
      description,
    };
  }

  // Build OpenAPI request object
  let openapiRequest: any = undefined;
  if (config.request) {
    openapiRequest = { body: undefined, query: undefined };
    if (config.request.body) {
      openapiRequest.body = {
        content: {
          "application/json": { schema: config.request.body },
        },
      };
    }
    if (config.request.query) {
      openapiRequest.query = {
        schema: config.request.query,
      };
    }
    // Remove undefined
    if (!openapiRequest.body) delete openapiRequest.body;
    if (!openapiRequest.query) delete openapiRequest.query;
    if (Object.keys(openapiRequest).length === 0) openapiRequest = undefined;
  }

  // Compose OpenAPIHono route
  return new OpenAPIHono().openapi(
    {
      method: config.method,
      path: config.path,
      ...(openapiRequest ? { request: openapiRequest } : {}),
      responses: openapiResponses,
      ...(config.tags ? { tags: config.tags } : {}),
      ...(config.summary ? { summary: config.summary } : {}),
      ...(config.description ? { description: config.description } : {}),
      ...(config.middleware ? { middleware: config.middleware } : {}),
    },
    async (c: any) => {
      let req: { body?: any; query?: any } = {};
      if (config.request?.body) {
        req.body = c.req.valid("json");
      }
      if (config.request?.query) {
        req.query = c.req.valid("query");
      }
      return config.handler(c, req);
    },
  );
}
