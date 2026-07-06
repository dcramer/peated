import * as Sentry from "@sentry/node";
import { describe, expect, test } from "vitest";
import {
  getCurrentActorContext,
  userToActorContext,
  withActorContext,
} from "../lib/actorContext";
import { applyJobActorContextToSentry } from "./context";
import { buildQueuedJobData, parseQueuedJobData } from "./payload";
import { parseJobContext } from "./types";

describe("worker context", () => {
  test("serializes Peated users as queue actor context", () => {
    expect(userToActorContext({ id: 123, username: "dcramer" })).toEqual({
      type: "user",
      userId: 123,
      username: "dcramer",
    });
  });

  test("ignores missing users", () => {
    expect(userToActorContext(null)).toBe(undefined);
    expect(userToActorContext(undefined)).toBe(undefined);
  });

  test("stores queue context outside Sentry", async () => {
    await withActorContext(
      {
        type: "user",
        userId: 321,
        username: "stored",
      },
      async () => {
        expect(getCurrentActorContext()).toEqual({
          type: "user",
          userId: 321,
          username: "stored",
        });
        expect(Sentry.getIsolationScope().getUser()?.id).toBeUndefined();
      },
    );
  });

  test("builds queued job data with current actor context", async () => {
    await withActorContext(
      {
        type: "user",
        userId: 123,
        username: "dcramer",
      },
      async () => {
        expect(
          buildQueuedJobData(
            { bottleId: 11868 },
            { "sentry-trace": "trace", baggage: "sampled" },
          ),
        ).toEqual({
          args: { bottleId: 11868 },
          context: {
            traceContext: { "sentry-trace": "trace", baggage: "sampled" },
            actor: {
              type: "user",
              userId: 123,
              username: "dcramer",
            },
          },
        });
      },
    );
  });

  test("restores user actor context onto a Sentry isolation scope", async () => {
    await Sentry.withIsolationScope(async (scope) => {
      applyJobActorContextToSentry(scope, {
        type: "user",
        userId: 456,
        username: "peated",
      });

      expect(scope.getUser()).toEqual({
        id: "456",
        username: "peated",
      });
      expect(scope.getScopeData().attributes).toEqual({
        "actor.type": "user",
        "actor.user_id": 456,
        "actor.username": "peated",
      });
    });
  });

  test("parses queued actor context from worker payloads", () => {
    expect(
      parseJobContext({
        traceContext: { "sentry-trace": "trace", baggage: "sampled" },
        actor: {
          type: "user",
          userId: 789,
          username: "queued",
        },
      }),
    ).toEqual({
      traceContext: { "sentry-trace": "trace", baggage: "sampled" },
      actor: {
        type: "user",
        userId: 789,
        username: "queued",
      },
    });
  });

  test("parses queued job data envelopes", () => {
    expect(
      parseQueuedJobData({
        args: { bottleId: 11868 },
        context: {
          traceContext: { "sentry-trace": "trace", baggage: "sampled" },
          actor: {
            type: "user",
            userId: 789,
            username: "queued",
          },
        },
      }),
    ).toEqual({
      args: { bottleId: 11868 },
      context: {
        traceContext: { "sentry-trace": "trace", baggage: "sampled" },
        actor: {
          type: "user",
          userId: 789,
          username: "queued",
        },
      },
    });
  });

  test("drops malformed queued actor context", () => {
    expect(
      parseJobContext({
        actor: {
          type: "user",
          userId: "not-a-number",
        },
      }),
    ).toEqual({});
  });
});
