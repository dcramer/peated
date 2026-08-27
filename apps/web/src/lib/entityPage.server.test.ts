import type { Entity } from "@peated/server/types";
import { describe, expect, it, vi } from "vitest";
import { createEntityPageLoader } from "./entityPage.server";

const entity = {
  id: 42,
  kind: "distillery",
} satisfies Pick<Entity, "id" | "kind">;

describe("Entity page loader", () => {
  it("returns an Entity on its canonical route", async () => {
    const loadEntity = vi.fn().mockResolvedValue(entity);
    const getRedirectPath = vi.fn().mockResolvedValue(null);
    const redirect = vi.fn((path: string): never => {
      throw new Error(`unexpected redirect:${path}`);
    });
    const loadPage = createEntityPageLoader({
      loadEntity,
      getRedirectPath,
      redirect,
    });

    await expect(loadPage(42)).resolves.toBe(entity);
    expect(getRedirectPath).toHaveBeenCalledWith({
      canonicalEntity: entity,
      currentId: 42,
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects a non-canonical route", async () => {
    const loadPage = createEntityPageLoader({
      loadEntity: vi.fn().mockResolvedValue(entity),
      getRedirectPath: vi.fn().mockResolvedValue("/distillers/42/"),
      redirect: (path: string): never => {
        throw new Error(`redirect:${path}`);
      },
    });

    await expect(loadPage(42)).rejects.toThrow("redirect:/distillers/42/");
  });
});
