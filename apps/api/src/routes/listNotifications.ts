import { SQL, and, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import {
  Notification,
  bottles,
  comments,
  entities,
  follows,
  notifications,
  tastings,
  toasts,
  users,
} from "../db/schema";
import { buildPageLink } from "../lib/paging";
import { serializeFollow } from "../lib/serializers/follow";
import { serializeTastingRef } from "../lib/serializers/tasting";
import { serializeUser } from "../lib/serializers/user";
import { requireAuth } from "../middleware/auth";

export default {
  method: "GET",
  url: "/notifications",
  schema: {
    querystring: {
      type: "object",
      properties: {
        page: { type: "number" },
        filter: { type: "string", enum: ["unread"] },
      },
    },
  },
  preHandler: [requireAuth],
  handler: async (req, res) => {
    const page = req.query.page || 1;

    const limit = 100;
    const offset = (page - 1) * limit;

    const where: (SQL<unknown> | undefined)[] = [
      eq(notifications.userId, req.user.id),
    ];
    if (req.query.filter === "unread") {
      where.push(eq(notifications.read, false));
    }

    const results = await db
      .select({
        notification: notifications,
        fromUser: users,
      })
      .from(notifications)
      .leftJoin(users, eq(users.id, notifications.fromUserId))
      .where(where ? and(...where) : undefined)
      .limit(limit + 1)
      .offset(offset)
      .orderBy(desc(notifications.createdAt));

    // follow requests need more details
    const followFromUserIdList = results
      .filter(({ notification }) => notification.objectType === "follow")
      .map(({ notification }) => notification.objectId);
    const followsBack = alias(follows, "follows_back");
    const followResults = followFromUserIdList.length
      ? await db
          .select({
            follow: follows,
            followsBack: followsBack.status,
            user: users,
          })
          .from(follows)
          .where(
            and(
              eq(follows.toUserId, req.user.id),
              inArray(follows.fromUserId, followFromUserIdList),
            ),
          )
          .innerJoin(users, eq(users.id, follows.fromUserId))
          .leftJoin(followsBack, eq(follows.fromUserId, followsBack.toUserId))
      : [];

    const followResultsByObjectId = Object.fromEntries(
      followResults.map((r) => [
        r.follow.fromUserId,
        {
          ...r.follow,
          followsBack: r.followsBack,
          user: r.user,
        },
      ]),
    );

    // toasts need more details
    const toastIdList = results
      .filter(({ notification }) => notification.objectType === "toast")
      .map(({ notification }) => notification.objectId);
    const toastResults = toastIdList.length
      ? (
          await db
            .select({
              toastId: toasts.id,
              tasting: tastings,
              bottle: bottles,
              brand: entities,
            })
            .from(tastings)
            .innerJoin(bottles, eq(tastings.bottleId, bottles.id))
            .innerJoin(entities, eq(bottles.brandId, entities.id))
            .innerJoin(toasts, eq(tastings.id, toasts.tastingId))
            .where(inArray(toasts.id, toastIdList))
        ).map((r) => ({
          toastId: r.toastId,
          ...r.tasting,
          bottle: {
            ...r.bottle,
            brand: r.brand,
          },
        }))
      : [];

    const toastResultsByObjectId = Object.fromEntries(
      toastResults.map((r) => [r.toastId, r]),
    );

    // comments need more details
    const commentIdList = results
      .filter(({ notification }) => notification.objectType === "comment")
      .map(({ notification }) => notification.objectId);
    const commentResults = commentIdList.length
      ? (
          await db
            .select({
              commentId: comments.id,
              tasting: tastings,
              bottle: bottles,
              brand: entities,
            })
            .from(tastings)
            .innerJoin(bottles, eq(tastings.bottleId, bottles.id))
            .innerJoin(entities, eq(bottles.brandId, entities.id))
            .innerJoin(comments, eq(tastings.id, comments.tastingId))
            .where(inArray(comments.id, commentIdList))
        ).map((r) => ({
          commentId: r.commentId,
          ...r.tasting,
          bottle: {
            ...r.bottle,
            brand: r.brand,
          },
        }))
      : [];

    const commentResultsByObjectId = Object.fromEntries(
      commentResults.map((r) => [r.commentId, r]),
    );

    const serializeRef = (notification: Notification) => {
      switch (notification.objectType) {
        case "follow":
          return serializeFollow(
            followResultsByObjectId[notification.objectId],
            req.user,
          );
        case "toast":
          return serializeTastingRef(
            toastResultsByObjectId[notification.objectId],
          );
        case "comment":
          return serializeTastingRef(
            commentResultsByObjectId[notification.objectId],
          );
        default:
          return undefined;
      }
    };

    const finalResults = results.map(({ fromUser, notification }) => {
      let ref: any;
      try {
        ref = serializeRef(notification);
      } catch (err) {
        return null;
      }
      return {
        ...notification,
        fromUser: fromUser ? serializeUser(fromUser, req.user) : null,
        ref,
      };
    });

    res.send({
      // remove results which are broken (e.g. we failed to delete a row)
      results: finalResults.filter((r) => !!r),
      rel: {
        nextPage: results.length > limit ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
        next:
          results.length > limit
            ? buildPageLink(req.routeOptions.url, req.query, page + 1)
            : null,
        prev:
          page > 1
            ? buildPageLink(req.routeOptions.url, req.query, page - 1)
            : null,
      },
    });
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Querystring: {
      page?: number;
      filter?: "unread";
    };
  }
>;
