import { SQL, and, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { RouteOptions } from "fastify";
import { IncomingMessage, Server, ServerResponse } from "http";
import { db } from "../db";
import { follows, notifications, tastings, toasts, users } from "../db/schema";
import { buildPageLink } from "../lib/paging";
import { serializeFollow } from "../lib/serializers/follow";
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
            followsBack: followsBack,
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
      ? await db
          .select({
            toastId: toasts.id,
            tasting: tastings,
          })
          .from(tastings)
          .innerJoin(toasts, eq(tastings.id, toasts.tastingId))
          .where(inArray(toasts.id, toastIdList))
      : [];

    const toastResultsByObjectId = Object.fromEntries(
      toastResults.map((r) => [r.toastId, r.tasting]),
    );

    res.send({
      results: results.map(({ fromUser, notification }) => ({
        ...notification,
        fromUser,
        ref:
          notification.objectType === "follow"
            ? serializeFollow(
                followResultsByObjectId[notification.objectId],
                req.user,
              )
            : notification.objectType === "toast"
            ? toastResultsByObjectId[notification.objectId]
            : undefined,
      })),
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
