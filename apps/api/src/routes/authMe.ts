import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "@peated/api/middleware/auth";
import { UserSchema } from "@peated/api/schemas";
import { serialize } from "@peated/api/serializers";
import { UserSerializer } from "@peated/api/serializers/user";
import { UnauthorizedError, unauthorizedSchema } from "http-errors-enhanced";
import { z } from "zod";

export default new OpenAPIHono().openapi(
  {
    method: "get",
    path: "/",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ user: UserSchema }),
          },
        },
        description: "User details",
      },
      401: unauthorizedSchema,
    },
    middleware: [requireAuth],
  },
  async function (c) {
    const currentUser = c.get("user");
    if (!currentUser) {
      throw new UnauthorizedError();
    }

    return c.json({
      user: await serialize(UserSerializer, currentUser, currentUser),
    });
  },
);
