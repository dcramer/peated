import buildFastify from "../app";
import { prisma } from "../lib/db";
import * as Fixtures from "../lib/test/fixtures";
import { FastifyInstance } from "fastify";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();
});

afterAll(async () => {
  await app.close();
});

test("lists checkins", async () => {
  const checkin = await Fixtures.Checkin();
  const checkin2 = await Fixtures.Checkin();

  let response = await app.inject({
    method: "GET",
    url: "/checkins",
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.length).toBe(2);
});

test("get checkin", async () => {
  const checkin = await Fixtures.Checkin();

  let response = await app.inject({
    method: "GET",
    url: `/checkins/${checkin.id}`,
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.id).toBe(checkin.id);
});
