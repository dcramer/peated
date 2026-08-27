import { db } from "@peated/server/db";
import { changes } from "@peated/server/db/schema";
import { and, eq } from "drizzle-orm";
import verifyEntityCreation from "./verifyEntityCreation";

describe("verifyEntityCreation", () => {
  test("records flagged findings for suspicious automated entities", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "Bourbon Whiskey",
      type: ["brand"],
    });

    await verifyEntityCreation({
      entityId: entity.id,
      creationSource: "price_match_automation",
    });

    const entityChanges = await db
      .select()
      .from(changes)
      .where(
        and(eq(changes.objectType, "entity"), eq(changes.objectId, entity.id)),
      );
    const verificationChange = entityChanges.find(
      (change) => change.data?.catalogVerification?.phase === "result",
    );
    const catalogVerification = verificationChange?.data.catalogVerification;
    if (catalogVerification?.phase !== "result") {
      throw new Error("Expected a catalog verification result change.");
    }

    expect(catalogVerification).toMatchObject({
      source: "price_match_automation",
      status: "flagged",
    });
    expect(
      catalogVerification.findings.map(
        (finding: { kind: string }) => finding.kind,
      ),
    ).toContain("entity_audit_candidate");
  });

  test("records skipped results for trusted creation flows", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "Trusted Brand",
      type: ["brand"],
    });

    await verifyEntityCreation({
      entityId: entity.id,
      creationSource: "repair_workflow",
    });

    const entityChanges = await db
      .select()
      .from(changes)
      .where(
        and(eq(changes.objectType, "entity"), eq(changes.objectId, entity.id)),
      );
    const verificationChange = entityChanges.find(
      (change) => change.data?.catalogVerification?.phase === "result",
    );

    expect(verificationChange?.data.catalogVerification).toMatchObject({
      source: "repair_workflow",
      status: "skipped",
    });
  });

  test("skips stale verification for a deleted Entity", async () => {
    await expect(
      verifyEntityCreation({
        entityId: 2_147_483_647,
        creationSource: "repair_workflow",
      }),
    ).resolves.toBeUndefined();
  });
});
