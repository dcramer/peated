import { db } from "@peated/server/db";
import { changes } from "@peated/server/db/schema";
import { and, eq } from "drizzle-orm";
import verifyBottleCreation from "./verifyBottleCreation";

describe("verifyBottleCreation", () => {
  test("records flagged findings for suspicious manually created bottles", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Canadian",
      type: ["brand", "distiller"],
    });
    await fixtures.Entity({
      name: "Canadian Club",
      type: ["brand"],
      totalBottles: 12,
    });
    const bottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Reserve 9-year-old Triple Aged",
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Canadian Club Reserve 9-year-old Triple Aged",
    });

    await verifyBottleCreation({
      bottleId: bottle.id,
      creationSource: "manual_entry",
    });

    const bottleChanges = await db
      .select()
      .from(changes)
      .where(
        and(eq(changes.objectType, "bottle"), eq(changes.objectId, bottle.id)),
      );
    const verificationChange = bottleChanges.find(
      (change) => change.data?.catalogVerification?.phase === "result",
    );

    expect(verificationChange?.data.catalogVerification).toMatchObject({
      source: "manual_entry",
      status: "flagged",
    });
    expect(
      verificationChange?.data.catalogVerification.findings.map(
        (finding: { kind: string }) => finding.kind,
      ),
    ).toContain("brand_repair_candidate");
  });

  test("records skipped results for trusted creation flows", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    await verifyBottleCreation({
      bottleId: bottle.id,
      creationSource: "price_match_review",
    });

    const bottleChanges = await db
      .select()
      .from(changes)
      .where(
        and(eq(changes.objectType, "bottle"), eq(changes.objectId, bottle.id)),
      );
    const verificationChange = bottleChanges.find(
      (change) => change.data?.catalogVerification?.phase === "result",
    );

    expect(verificationChange?.data.catalogVerification).toMatchObject({
      source: "price_match_review",
      status: "skipped",
    });
  });
});
