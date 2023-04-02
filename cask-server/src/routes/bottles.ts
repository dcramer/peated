import type { RouteHandlerMethod } from "fastify";
import { prisma } from "../lib/db";

export const listBottles: RouteHandlerMethod = async (req, res) => {
  const results = await prisma.bottle.findMany({
    take: 100,
  });
  res.send(results);
};

export const getBottle: RouteHandlerMethod = async (req, res) => {
  const bottle = await prisma.bottle.findUnique({
    where: {
      id: parseInt(req.params.bottleId, 10),
    },
  });
  if (!bottle) {
    res.status(404).send({ error: "Not found" });
  } else {
    res.send(bottle);
  }
};
