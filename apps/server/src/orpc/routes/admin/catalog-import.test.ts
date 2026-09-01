import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { beforeEach, vi } from "vitest";

describe("POST /admin/catalog/bottles", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("creates reviewed catalog data without AI follow-up", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const brand = await fixtures.Entity();
    const result = await routerClient.admin.catalogImport(
      {
        name: "Reviewed release",
        brand: brand.id,
        description: "Text copied from the official product page.",
        descriptionSrc: "user",
      },
      { context: { user: admin } },
    );

    expect(result).toMatchObject({
      name: "Reviewed release",
      description: "Text copied from the official product page.",
      descriptionSrc: "user",
    });
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, result.id),
      }),
    ).toMatchObject({ descriptionSrc: "user" });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith("OnBottleChange", {
      bottleId: result.id,
      generateDetails: false,
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "VerifyBottleCreation",
      {
        bottleId: result.id,
        creationSource: "repair_workflow",
      },
      { delay: 5000 },
    );
  });

  test("requires an administrator without writing", async ({
    fixtures,
    defaults,
  }) => {
    const brand = await fixtures.Entity();
    const input = { name: "Denied reviewed release", brand: brand.id };

    const anonymousError = await waitError(
      routerClient.admin.catalogImport(input),
    );
    const userError = await waitError(
      routerClient.admin.catalogImport(input, {
        context: { user: defaults.user },
      }),
    );

    expect(anonymousError).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
    expect(userError).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
    expect(await db.select().from(bottles)).toHaveLength(0);
  });
});
