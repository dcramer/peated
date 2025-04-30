import type { FastifyInstance } from "fastify";
import { FormDataEncoder } from "form-data-encoder";
import { FormData } from "formdata-node";
import path from "path";
import sharp from "sharp";
import { Readable } from "stream";
import buildFastify from "../app";
import config from "../config";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    await app.close();
  };
});

test("cannot update another user's tasting", async ({ fixtures }) => {
  const user = await fixtures.User();
  const otherUser = await fixtures.User();
  const tasting = await fixtures.Tasting({ createdById: otherUser.id });

  const response = await app.inject({
    method: "POST",
    url: `/tastings/${tasting.id}/image`,
    payload: {},
    headers: await fixtures.AuthenticatedHeaders({ user }),
  });

  expect(response).toRespondWith(403);
});

test("tasting image does resize down", async ({ fixtures, defaults }) => {
  const form = new FormData();
  form.append(
    "file",
    await fixtures.SampleSquareImage(),
    "sample-square-image.jpg",
  );

  const encoder = new FormDataEncoder(form);

  const tasting = await fixtures.Tasting({
    createdById: defaults.user.id,
  });
  const response = await app.inject({
    method: "POST",
    url: `/tastings/${tasting.id}/image`,
    payload: Readable.from(encoder.encode()),
    headers: {
      ...defaults.authHeaders,
      ...encoder.headers,
    },
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.imageUrl).toBeDefined();

  expect(path.extname(data.imageUrl)).toBe(".webp");

  // grab the file
  const filepath = `${config.UPLOAD_PATH}/${path.basename(data.imageUrl)}`;
  const metadata = await sharp(filepath).metadata();
  expect(metadata.format).toBe("webp");
  expect(metadata.height).toBeLessThanOrEqual(1024);
  expect(metadata.width).toBeLessThanOrEqual(1024);
});
