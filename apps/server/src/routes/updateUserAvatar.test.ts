import type { FastifyInstance } from "fastify";
import { FormDataEncoder } from "form-data-encoder";
import { FormData } from "formdata-node";
import path from "path";
import sharp from "sharp";
import { Readable } from "stream";
import buildFastify from "../app";
import config from "../config";
import * as Fixtures from "../lib/test/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    await app.close();
  };
});

test("cannot update another user's avatar", async () => {
  const user = await Fixtures.User();
  const otherUser = await Fixtures.User();

  const response = await app.inject({
    method: "POST",
    url: `/users/${otherUser.id}/avatar`,
    headers: await Fixtures.AuthenticatedHeaders({ user }),
  });

  expect(response).toRespondWith(403);
});

test("avatar does resize down", async () => {
  const form = new FormData();
  form.append(
    "file",
    await Fixtures.SampleSquareImage(),
    "sample-square-image.jpg",
  );

  const encoder = new FormDataEncoder(form);

  const response = await app.inject({
    method: "POST",
    url: `/users/${DefaultFixtures.user.id}/avatar`,
    payload: Readable.from(encoder.encode()),
    headers: {
      ...DefaultFixtures.authHeaders,
      ...encoder.headers,
    },
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.pictureUrl).toBeDefined();

  expect(path.extname(data.pictureUrl)).toBe(".webp");

  // grab the file
  const filepath = `${config.UPLOAD_PATH}/${path.basename(data.pictureUrl)}`;
  const metadata = await sharp(filepath).metadata();
  expect(metadata.format).toBe("webp");
  expect(metadata.width).toBe(500);
  expect(metadata.height).toBe(500);
});
