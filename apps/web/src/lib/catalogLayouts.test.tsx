import { afterEach, describe, expect, it, vi } from "vitest";
import {
  existingBottleDetails,
  testOwnedEntity,
} from "../../e2e/rpc-fixtures.mjs";
import BottleLayout from "../app/(app)/bottles/[bottleId]/layout";
import EntityLayout from "../app/(app)/entities/[entityId]/layout";

import { withNextRequest } from "./test/nextRequest";

await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  vi.stubGlobal("AsyncLocalStorage", AsyncLocalStorage);
  vi.stubEnv(
    "SESSION_SECRET",
    "peated-cache-tests-session-secret-for-local-tests",
  );
});

const fetchMock = vi.fn<typeof fetch>();
afterEach(() => vi.unstubAllGlobals());

describe.each([
  {
    name: "Bottle",
    publicRecord: existingBottleDetails,
    memberRecord: { ...existingBottleDetails, isFavorite: true },
    prop: "initialBottle",
    render: () =>
      BottleLayout({
        children: null,
        params: Promise.resolve({ bottleId: String(existingBottleDetails.id) }),
      }),
  },
  {
    name: "Entity",
    publicRecord: testOwnedEntity,
    memberRecord: { ...testOwnedEntity, isFollowing: true },
    prop: "initialEntity",
    render: () =>
      EntityLayout({
        children: null,
        params: Promise.resolve({ entityId: String(testOwnedEntity.id) }),
      }),
  },
])("$name page frame", ({ publicRecord, memberRecord, prop, render }) => {
  it("reuses the canonical anonymous record", async () => {
    fetchMock
      .mockReset()
      .mockResolvedValue(Response.json({ json: publicRecord }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await withNextRequest(null, render);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.props.children[1].props[prop]).toEqual(publicRecord);
  });

  it("keeps fresh member state", async () => {
    fetchMock
      .mockReset()
      .mockResolvedValueOnce(Response.json({ json: publicRecord }))
      .mockResolvedValueOnce(Response.json({ json: memberRecord }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await withNextRequest("test-member", render);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.props.children[1].props[prop]).toEqual(memberRecord);
  });
});
