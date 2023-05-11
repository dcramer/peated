import type { RouteOptions } from "fastify";
import { prisma } from "../lib/db";
import { IncomingMessage, Server, ServerResponse } from "http";
import {
  Bottle,
  Brand,
  Checkin,
  Distiller,
  Edition,
  Prisma,
  User,
} from "@prisma/client";
import { validateRequest } from "../middleware/auth";
import { storeFile } from "../lib/uploads";
import config from "../config";
import { serializeUser } from "../lib/auth";

export const serializeCheckin = (
  checkin: Checkin & {
    user: User;
    bottle: Bottle & {
      brand: Brand;
      distiller?: Distiller | null;
      edition?: Edition | null;
    };
  },
  currentUser?: User
) => {
  const data: { [key: string]: any } = {
    id: checkin.id,
    imageUrl: checkin.imageUrl
      ? `${config.URL_PREFIX}${checkin.imageUrl}`
      : null,
    bottle: checkin.bottle,
    user: serializeUser(checkin.user, currentUser),
    tastingNotes: checkin.tastingNotes,
    tags: checkin.tags,
    rating: checkin.rating,
    edition: checkin.edition,
    createdAt: checkin.createdAt,
  };
  return data;
};

export const listCheckins: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Querystring: {
      page?: number;
      bottle?: number;
      user?: number;
    };
  }
> = {
  method: "GET",
  url: "/checkins",
  schema: {
    querystring: {
      type: "object",
      properties: {
        page: { type: "number" },
        bottle: { type: "number" },
        user: { type: "number" },
      },
    },
  },
  handler: async (req, res) => {
    const page = req.query.page || 1;

    const limit = 100;
    const offset = (page - 1) * limit;

    const where: Prisma.CheckinWhereInput = {};
    if (req.query.bottle) {
      where.bottleId = req.query.bottle;
    }
    if (req.query.user) {
      where.userId = req.query.user;
    }

    const results = await prisma.checkin.findMany({
      include: {
        bottle: {
          include: { brand: true, distillers: true },
        },
        edition: true,
        user: true,
      },
      where,
      skip: offset,
      take: limit,
      orderBy: { createdAt: "desc" },
    });
    res.send(results.map((c) => serializeCheckin(c, req.user)));
  },
};

export const getCheckin: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      checkinId: number;
    };
  }
> = {
  method: "GET",
  url: "/checkins/:checkinId",
  schema: {
    params: {
      type: "object",
      required: ["checkinId"],
      properties: {
        checkinId: { type: "number" },
      },
    },
  },
  handler: async (req, res) => {
    const checkin = await prisma.checkin.findUnique({
      include: {
        bottle: {
          include: { brand: true, distillers: true },
        },
        edition: true,
        user: true,
      },
      where: {
        id: req.params.checkinId,
      },
    });
    if (!checkin) {
      res.status(404).send({ error: "Not found" });
    } else {
      res.send(serializeCheckin(checkin, req.user));
    }
  },
};

export const addCheckin: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: Checkin & {
      bottle: number;
      edition?: string;
      barrel?: number;
    };
  }
> = {
  method: "POST",
  url: "/checkins",
  schema: {
    body: {
      type: "object",
      required: ["bottle", "rating"],
      properties: {
        bottle: { type: "number" },
        rating: { type: "number", minimum: 0, maximum: 5 },
        tastingNotes: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        edition: { type: "string" },
        barrel: { type: "number" },
      },
    },
  },
  preHandler: [validateRequest],
  handler: async (req, res) => {
    const body = req.body;
    const user = req.user;

    // gross syntax, whats better?
    const data: Prisma.CheckinUncheckedCreateInput & {
      edition?: Prisma.EditionCreateNestedOneWithoutCheckinsInput;
    } = (({ bottle, ...d }: any) => d)(body);

    if (Array.isArray(data.tags))
      data.tags = data.tags.map((t) => t.toLowerCase());

    if (body.bottle) {
      let bottle = await prisma.bottle.findUnique({
        where: { id: body.bottle },
      });

      if (!bottle) {
        res.status(400).send({ error: "Invalid bottle" });
        return;
      } else {
        data.bottleId = bottle.id;
      }
    }

    if (body.edition) {
      Í;
      data.edition = {
        connectOrCreate: {
          where: {
            bottleId_name_barrel: {
              bottleId: data.bottleId,
              name: body.edition,
              barrel: body.barrel,
            },
          },
          create: {
            bottleId: data.bottleId,
            name: body.edition,
            barrel: body.barrel,
          },
        },
      };
    }

    data.userId = user.id;

    // TODO(dcramer): delete file if this fails
    const checkin = await prisma.checkin.create({
      data,
      include: {
        bottle: {
          include: { brand: true },
        },
        edition: true,
        user: true,
      },
    });

    res.status(201).send(serializeCheckin(checkin, req.user));
  },
};

export const updateCheckinImage: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      checkinId: number;
    };
    Body: {
      image?: File;
    };
  }
> = {
  method: "POST",
  url: "/checkins/:checkinId/image",
  schema: {
    params: {
      type: "object",
      required: ["checkinId"],
      properties: {
        checkinId: { type: "number" },
      },
    },
  },
  preHandler: [validateRequest],
  handler: async (req, res) => {
    const checkin = await prisma.checkin.findUnique({
      where: {
        id: req.params.checkinId,
      },
    });
    if (!checkin) {
      return res.status(404).send({ error: "Not found" });
    }

    if (checkin.userId !== req.user.id && !req.user.admin) {
      return res.status(403).send({ error: "Forbidden" });
    }

    if (!req.isMultipart()) {
      return res.status(400).send({ error: "Bad request" });
    }

    const fileData = await req.file();
    if (!fileData) {
      return res.status(400).send({ error: "Bad request" });
    }

    const data: Prisma.CheckinUncheckedUpdateInput = {};
    data.imageUrl = await storeFile({
      data: fileData,
      namespace: `checkins`,
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

    const newCheckin = await prisma.checkin.update({
      where: {
        id: checkin.id,
      },
      data,
    });

    res.send({
      imageUrl: newCheckin.imageUrl
        ? `${config.URL_PREFIX}${newCheckin.imageUrl}`
        : null,
    });
  },
};
