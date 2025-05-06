import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { Handler } from "hono";
import type { ZodType } from "zod";
import type {
  ReferenceObject,
  SchemaObject,
} from "zod-openapi/dist/openapi3-ts/dist/oas31";

type Path = Parameters<typeof createRoute>[0]["path"];
type Method = Parameters<typeof createRoute>[0]["method"];
type Request = Omit<Parameters<typeof createRoute>[0]["request"], "body"> & {
  body?: ZodType;
};
type Schema = ZodType<unknown> | SchemaObject | ReferenceObject;

type Responses = { [statusCode: string]: Schema };

type PartialOpts = {
  schema?: Request;
  responses?: Responses;
};

export class ApiRoutes {
  private app: OpenAPIHono;

  constructor() {
    this.app = new OpenAPIHono();
  }

  fetch(
    ...args: Parameters<typeof this.app.fetch>
  ): ReturnType<typeof this.app.fetch> {
    return this.app.fetch(...args);
  }

  private route({
    path,
    method,
    schema = {},
    responses = {},
    handler,
  }: {
    path: Path;
    method: Method;
    schema?: Request;
    responses?: Responses;
    handler: Handler;
  }) {
    this.app.openapi(
      createRoute({
        method,
        path,
        request: {
          ...schema,
          body: schema.body
            ? {
                content: {
                  "application/json": {
                    schema: schema.body,
                  },
                },
              }
            : undefined,
        },
        responses: Object.fromEntries(
          Object.entries(responses).map(([status, schema]) => [
            status,
            {
              content: {
                "application/json": { schema },
              },
              description: "Response",
            },
          ]),
        ),
      }),
      handler,
    );
    return this;
  }

  get(path: Path, opts: PartialOpts, handler: Handler) {
    return this.route({ path, method: "get", ...opts, handler });
  }

  post(path: Path, opts: PartialOpts, handler: Handler) {
    return this.route({ path, method: "post", ...opts, handler });
  }

  put(path: Path, opts: PartialOpts, handler: Handler) {
    return this.route({ path, method: "put", ...opts, handler });
  }

  delete(path: Path, opts: PartialOpts, handler: Handler) {
    return this.route({ path, method: "delete", ...opts, handler });
  }
}
