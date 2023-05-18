import { FastifyInstance } from "fastify";
import buildFastify from "../app";
import { db } from "../db";
import { comments, follows, toasts } from "../db/schema";
import { createNotification, objectTypeFromSchema } from "../lib/notifications";
import * as Fixtures from "../lib/test/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    app.close();
  };
});

test("lists notifications w/ toast", async () => {
  const tasting = await Fixtures.Tasting({
    createdById: DefaultFixtures.user.id,
  });
  const toast = await Fixtures.Toast({ tastingId: tasting.id });
  const notification = await createNotification(db, {
    objectId: toast.id,
    objectType: objectTypeFromSchema(toasts),
    userId: tasting.createdById,
    fromUserId: toast.createdById,
    createdAt: toast.createdAt,
  });

  const response = await app.inject({
    method: "GET",
    url: "/notifications",
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const { results } = JSON.parse(response.payload);
  expect(results.length).toBe(1);
  expect(results[0].id).toEqual(`${notification.id}`);
  expect(results[0].objectType).toEqual("toast");
  expect(results[0].ref).toBeDefined();
  expect(results[0].ref.id).toEqual(`${tasting.id}`);
});

test("lists notifications w/ comment", async () => {
  const tasting = await Fixtures.Tasting({
    createdById: DefaultFixtures.user.id,
  });
  const comment = await Fixtures.Comment({ tastingId: tasting.id });
  const notification = await createNotification(db, {
    objectId: comment.id,
    objectType: objectTypeFromSchema(comments),
    userId: tasting.createdById,
    fromUserId: comment.createdById,
    createdAt: comment.createdAt,
  });

  const response = await app.inject({
    method: "GET",
    url: "/notifications",
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const { results } = JSON.parse(response.payload);
  expect(results.length).toBe(1);
  expect(results[0].id).toEqual(`${notification.id}`);
  expect(results[0].objectType).toEqual("comment");
  expect(results[0].ref).toBeDefined();
  expect(results[0].ref.id).toEqual(`${tasting.id}`);
});

test("lists notifications w/ follow", async () => {
  const follow = await Fixtures.Follow({ toUserId: DefaultFixtures.user.id });
  const notification = await createNotification(db, {
    objectId: follow.id,
    objectType: objectTypeFromSchema(follows),
    userId: follow.toUserId,
    fromUserId: follow.fromUserId,
    createdAt: follow.createdAt,
  });

  const response = await app.inject({
    method: "GET",
    url: "/notifications",
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const { results } = JSON.parse(response.payload);
  expect(results.length).toBe(1);
  expect(results[0].id).toEqual(`${notification.id}`);
  expect(results[0].objectType).toEqual("follow");
  expect(results[0].ref).toBeDefined();
  expect(results[0].ref.id).toEqual(`${follow.id}`);
});
