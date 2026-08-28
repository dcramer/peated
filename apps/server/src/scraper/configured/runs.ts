import { type AnyDatabase, db } from "@peated/server/db";
import {
  configuredScraperConfigVersions,
  configuredScraperRuns,
  configuredScrapers,
  externalSiteRuns,
} from "@peated/server/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { DEFAULT_SCRAPER_REQUEST_POLICY } from "../definitions";
import {
  ConfiguredScraperNotFoundError,
  ConfiguredScraperValidationError,
} from "./service";

export async function createPinnedConfiguredRun(
  connection: AnyDatabase,
  input: {
    externalSiteId: number;
    requestedById?: number;
    trigger: "manual" | "scheduled";
    purpose: "collect" | "preview";
    configVersionId?: number;
  },
) {
  const conditions = [
    eq(configuredScrapers.externalSiteId, input.externalSiteId),
  ];
  if (input.purpose === "collect") {
    conditions.push(eq(configuredScrapers.enabled, true));
  }
  const [selected] = await connection
    .select({
      scraper: configuredScrapers,
      version: configuredScraperConfigVersions,
    })
    .from(configuredScrapers)
    .innerJoin(
      configuredScraperConfigVersions,
      input.configVersionId
        ? eq(configuredScraperConfigVersions.id, input.configVersionId)
        : eq(
            configuredScraperConfigVersions.id,
            configuredScrapers.activeConfigVersionId,
          ),
    )
    .where(and(...conditions));
  if (
    !selected ||
    selected.version.configuredScraperId !== selected.scraper.id ||
    (input.purpose === "collect" &&
      selected.version.validationStatus !== "passed")
  ) {
    throw new ConfiguredScraperValidationError(
      "No tested version is ready for this run.",
    );
  }
  const [run] = await connection
    .insert(externalSiteRuns)
    .values({
      externalSiteId: input.externalSiteId,
      trigger: input.trigger,
      requestedById: input.requestedById,
      requestLimit: Math.min(
        selected.version.config.index.maxItems + 1,
        DEFAULT_SCRAPER_REQUEST_POLICY.requestLimit,
      ),
    })
    .returning();
  if (!run) throw new Error("Failed to create source run.");
  await connection.insert(configuredScraperRuns).values({
    externalSiteRunId: run.id,
    configuredScraperId: selected.scraper.id,
    configVersionId: selected.version.id,
    purpose: input.purpose,
  });
  return { run, scraper: selected.scraper, version: selected.version };
}

export async function createConfiguredGenerationRun(input: {
  configuredScraperId: number;
  requestedById: number;
}) {
  return await db.transaction(async (tx) => {
    const [scraper] = await tx
      .select()
      .from(configuredScrapers)
      .where(eq(configuredScrapers.id, input.configuredScraperId))
      .for("update");
    if (!scraper) throw new ConfiguredScraperNotFoundError();
    if (!scraper.allowLlmProcessing) {
      throw new ConfiguredScraperValidationError(
        "AI suggestions are not allowed for this source.",
      );
    }
    const [latestVersion] = await tx
      .select({
        validationStatus: configuredScraperConfigVersions.validationStatus,
      })
      .from(configuredScraperConfigVersions)
      .where(
        eq(configuredScraperConfigVersions.configuredScraperId, scraper.id),
      )
      .orderBy(desc(configuredScraperConfigVersions.version))
      .limit(1);
    if (latestVersion && latestVersion.validationStatus !== "failed") {
      throw new ConfiguredScraperValidationError(
        "AI repair is available only after the latest test fails.",
      );
    }
    const [run] = await tx
      .insert(externalSiteRuns)
      .values({
        externalSiteId: scraper.externalSiteId,
        trigger: "manual",
        requestedById: input.requestedById,
        requestLimit: Math.min(scraper.sampleUrls.length + 1, 11),
      })
      .returning();
    if (!run) throw new Error("Failed to create AI suggestion run.");
    await tx.insert(configuredScraperRuns).values({
      externalSiteRunId: run.id,
      configuredScraperId: scraper.id,
      configVersionId: null,
      purpose: "generate",
    });
    return run;
  });
}
