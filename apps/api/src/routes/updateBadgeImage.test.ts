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

test("requires admin", async ({ fixtures }) => {
  const user = await fixtures.User({ mod: true, admin: false });
  const badge = await fixtures.Badge();

  const response = await app.inject({
    method: "POST",
    url: `/badges/${badge.id}/image`,
    payload: {},
    headers: await fixtures.AuthenticatedHeaders({ user }),
  });

  expect(response).toRespondWith(403);
});

test("badge image does resize down", async ({ fixtures, defaults }) => {
  const form = new FormData();
  form.append(
    "file",
    await fixtures.SampleSquareImage(),
    "sample-square-image.jpg",
  );

  const encoder = new FormDataEncoder(form);

  const user = await fixtures.User({ admin: true });

  const badge = await fixtures.Badge();
  const response = await app.inject({
    method: "POST",
    url: `/badges/${badge.id}/image`,
    payload: Readable.from(encoder.encode()),
    headers: {
      ...(await fixtures.AuthenticatedHeaders({ user })),
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
  expect(metadata.width).toBe(500);
  expect(metadata.height).toBe(500);
});
