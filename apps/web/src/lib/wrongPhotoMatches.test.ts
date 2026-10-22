import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import { saveWrongPhotoMatchPick } from "./wrongPhotoMatches";

describe("saveWrongPhotoMatchPick", () => {
  it("keeps the report when the pick is saved", async () => {
    const save = async () => ({ withdrawn: false });

    expect(await saveWrongPhotoMatchPick(save, 7, 42)).toBe(false);
  });

  it("drops the report when the pick withdrew it", async () => {
    const save = async () => ({ withdrawn: true });

    expect(await saveWrongPhotoMatchPick(save, 7, 42)).toBe(true);
  });

  it("treats an already-deleted report as gone", async () => {
    const save = async (): Promise<{ withdrawn: boolean }> => {
      throw new ORPCError("NOT_FOUND", { defined: true, status: 404 });
    };

    expect(await saveWrongPhotoMatchPick(save, 7, 42)).toBe(true);
  });

  it("keeps the report through other failures without blocking", async () => {
    const save = async (): Promise<{ withdrawn: boolean }> => {
      throw new Error("network down");
    };

    expect(await saveWrongPhotoMatchPick(save, 7, 42)).toBe(false);
  });
});
