import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { validateRequest } from "../middleware/auth";
import { storeFile } from "../lib/uploads";
import config from "../config";
import { serializeUser } from "../lib/auth";

export const serializeTasting = (
  tasting: Tasting & {
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
    id: tasting.id,
    imageUrl: tasting.imageUrl
      ? `${config.URL_PREFIX}${tasting.imageUrl}`
      : null,
    bottle: tasting.bottle,
    user: serializeUser(tasting.user, currentUser),
    tastingNotes: tasting.tastingNotes,
    tags: tasting.tags,
    rating: tasting.rating,
    edition: tasting.edition,
    createdAt: tasting.createdAt,
  };
  return data;
};

export const listTastings: RouteOptions<
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
  url: "/tastings",
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

    const where: Prisma.TastingWhereInput = {};
    if (req.query.bottle) {
      where.bottleId = req.query.bottle;
    }
    if (req.query.user) {
      where.userId = req.query.user;
    }

    const results = await prisma.tasting.findMany({
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
    res.send(results.map((c) => serializeTasting(c, req.user)));
  },
};

export const getTasting: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      tastingId: number;
    };
  }
> = {
  method: "GET",
  url: "/tastings/:tastingId",
  schema: {
    params: {
      type: "object",
      required: ["tastingId"],
      properties: {
        tastingId: { type: "number" },
      },
    },
  },
  handler: async (req, res) => {
    const tasting = await prisma.tasting.findUnique({
      include: {
        bottle: {
          include: { brand: true, distillers: true },
        },
        edition: true,
        user: true,
      },
      where: {
        id: req.params.tastingId,
      },
    });
    if (!tasting) {
      res.status(404).send({ error: "Not found" });
    } else {
      res.send(serializeTasting(tasting, req.user));
    }
  },
};

export const addTasting: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Body: Tasting & {
      bottle: number;
      edition?: string;
      barrel?: number;
    };
  }
> = {
  method: "POST",
  url: "/tastings",
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
    const data: Prisma.TastingUncheckedCreateInput & {
      edition?: Prisma.EditionCreateNestedOneWithoutTastingsInput;
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
    const tasting = await prisma.tasting.create({
      data,
      include: {
        bottle: {
          include: { brand: true },
        },
        edition: true,
        user: true,
      },
    });

    res.status(201).send(serializeTasting(tasting, req.user));
  },
};

export const updateTastingImage: RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      tastingId: number;
    };
    Body: {
      image?: File;
    };
  }
> = {
  method: "POST",
  url: "/tastings/:tastingId/image",
  schema: {
    params: {
      type: "object",
      required: ["tastingId"],
      properties: {
        tastingId: { type: "number" },
      },
    },
  },
  preHandler: [validateRequest],
  handler: async (req, res) => {
    const tasting = await prisma.tasting.findUnique({
      where: {
        id: req.params.tastingId,
      },
    });
    if (!tasting) {
      return res.status(404).send({ error: "Not found" });
    }

    if (tasting.userId !== req.user.id && !req.user.admin) {
      return res.status(403).send({ error: "Forbidden" });
    }

    if (!req.isMultipart()) {
      return res.status(400).send({ error: "Bad request" });
    }

    const fileData = await req.file();
    if (!fileData) {
      return res.status(400).send({ error: "Bad request" });
    }

    const data: Prisma.TastingUncheckedUpdateInput = {};
    data.imageUrl = await storeFile({
      data: fileData,
      namespace: `tastings`,
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

    const newTasting = await prisma.tasting.update({
      where: {
        id: tasting.id,
      },
      data,
    });

    res.send({
      imageUrl: newTasting.imageUrl
        ? `${config.URL_PREFIX}${newTasting.imageUrl}`
        : null,
    });
  },
};
