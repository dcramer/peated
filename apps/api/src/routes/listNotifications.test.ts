import { db } from "@peated/core/db";
import type { FastifyInstance } from "fastify";
import buildFastify from "../app";
import { createNotification } from "../lib/notifications";
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
    type: "toast",
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
  expect(results[0].id).toEqual(notification.id);
  expect(results[0].type).toEqual("toast");
  expect(results[0].ref).toBeDefined();
  expect(results[0].ref.id).toEqual(tasting.id);
});

test("lists notifications w/ comment", async () => {
  const tasting = await Fixtures.Tasting({
    createdById: DefaultFixtures.user.id,
  });
  const comment = await Fixtures.Comment({ tastingId: tasting.id });
  const notification = await createNotification(db, {
    objectId: comment.id,
    type: "comment",
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
  expect(results[0].id).toEqual(notification.id);
  expect(results[0].type).toEqual("comment");
  expect(results[0].ref).toBeDefined();
  expect(results[0].ref.id).toEqual(tasting.id);
});

test("lists notifications w/ friend_request", async () => {
  const follow = await Fixtures.Follow({ toUserId: DefaultFixtures.user.id });
  const notification = await createNotification(db, {
    objectId: follow.id,
    type: "friend_request",
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
  expect(results[0].id).toEqual(notification.id);
  expect(results[0].type).toEqual("friend_request");
  expect(results[0].ref).toBeDefined();
  expect(results[0].ref.user.id).toEqual(follow.fromUserId);
});
