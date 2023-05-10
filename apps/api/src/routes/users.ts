import type { RouteOptions } from "fastify";
import { prisma } from "../lib/db";
import { Prisma, User } from "@prisma/client";
import { IncomingMessage, Server, ServerResponse } from "http";
import { validateRequest } from "../middleware/auth";
import { storeFile } from "../lib/uploads";
import config from "../config";
import { serializeUser } from "../lib/auth";

export const updateUser: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      userId: number | "me";
    };
    Body: Partial<Pick<User, "displayName">> & {
      picture?: File;
    };
  }
> = {
  method: "PUT",
  url: "/users/:userId",
  schema: {
    params: {
      type: "object",
      required: ["userId"],
      properties: {
        userId: { oneOf: [{ type: "number" }, { const: "me" }] },
      },
    },
    body: {
      type: "object",
      properties: {
        displayName: { type: "string" },
      },
    },
  },
  preHandler: [validateRequest],
  handler: async (req, res) => {
    const userId = req.params.userId === "me" ? req.user.id : req.params.userId;

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (!user) {
      return res.status(404).send({ error: "Not found" });
    }

    if (user.id !== req.user.id && !user.admin) {
      return res.status(403).send({ error: "Forbidden" });
    }

    const body = req.body;
    const data: Prisma.UserUncheckedUpdateInput = {};
    if (body.displayName) {
      data.displayName = body.displayName;
    }

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data,
    });

    res.send(serializeUser(user, req.user));
  },
};

export const updateUserAvatar: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      userId: number | "me";
    };
    Body: {
      picture?: File;
    };
  }
> = {
  method: "POST",
  url: "/users/:userId/avatar",
  schema: {
    params: {
      type: "object",
      required: ["userId"],
      properties: {
        userId: { oneOf: [{ type: "number" }, { const: "me" }] },
      },
    },
  },
  preHandler: [validateRequest],
  handler: async (req, res) => {
    const userId = req.params.userId === "me" ? req.user.id : req.params.userId;

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (!user) {
      return res.status(404).send({ error: "Not found" });
    }

    if (user.id !== req.user.id && !req.user.admin) {
      return res.status(403).send({ error: "Forbidden" });
    }

    if (!req.isMultipart()) {
      return res.status(400).send({ error: "Bad request" });
    }

    const fileData = await req.file();
    if (!fileData) {
      return res.status(400).send({ error: "Bad request" });
    }

    const data: Prisma.UserUncheckedUpdateInput = {};
    data.pictureUrl = await storeFile({
      data: fileData,
      namespace: `avatars`,
      urlPrefix: "/uploads",
    });

    if (fileData.file.truncated) {
      // TODO: delete the file
      return res.status(413).send({
        code: "FST_FILES_LIMIT",
        error: "Payload Too Large",
        message: "reach files limit",
      });
    }

    const newUser = await prisma.user.update({
      where: {
        id: user.id,
      },
      data,
    });

    res.send({
      pictureUrl: newUser.pictureUrl
        ? `${config.URL_PREFIX}${newUser.pictureUrl}`
        : null,
    });
  },
};
