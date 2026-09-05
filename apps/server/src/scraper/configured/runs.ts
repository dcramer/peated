import { type AnyDatabase, db } from "@peated/server/db";
import {
  externalSiteRuns,
  scrapeSourceRevisions,
  scrapeSourceRuns,
  scrapeSources,
} from "@peated/server/db/schema";
import { and, desc, eq } from "drizzle-orm";
import {
  SCRAPE_SOURCE_MAX_LIST_PAGES,
  parseScrapeRules,
  scrapeRulesLimit,
} from "./rules";
import {
  ScrapeSourceNotFoundError,
  ScrapeSourceValidationError,
} from "./service";
import { suggestionRequestLimit } from "./setupAgent";

export async function createPinnedScrapeSourceRun(
  connection: AnyDatabase,
  input: {
    externalSiteId: number;
    scrapeSourceId?: number;
    requestedById?: number;
    trigger: "manual" | "scheduled";
    purpose: "collect" | "preview";
    revisionId?: number;
  },
) {
  const sourceConditions = [
    eq(scrapeSources.externalSiteId, input.externalSiteId),
  ];
  if (input.scrapeSourceId) {
    sourceConditions.push(eq(scrapeSources.id, input.scrapeSourceId));
  }
  if (input.purpose === "collect") {
    sourceConditions.push(eq(scrapeSources.enabled, true));
  }
  const revisionConditions = [
    eq(scrapeSourceRevisions.scrapeSourceId, scrapeSources.id),
    input.revisionId
      ? eq(scrapeSourceRevisions.id, input.revisionId)
      : eq(scrapeSourceRevisions.active, true),
  ];
  const selected = await connection
    .select({ source: scrapeSources, revision: scrapeSourceRevisions })
    .from(scrapeSources)
    .innerJoin(scrapeSourceRevisions, and(...revisionConditions))
    .where(and(...sourceConditions))
    .limit(2);
  if (
    selected.length !== 1 ||
    (input.purpose === "collect" &&
      selected[0]?.revision.previewStatus !== "passed")
  ) {
    throw new ScrapeSourceValidationError(
      input.purpose === "preview"
        ? "This version does not belong to this site."
        : "This site does not have an active version that passed preview.",
    );
  }
  const [{ source, revision }] = selected;
  const rules = parseScrapeRules(revision.rulesVersion, revision.rules);
  const [run] = await connection
    .insert(externalSiteRuns)
    .values({
      externalSiteId: source.externalSiteId,
      trigger: input.trigger,
      requestedById: input.requestedById,
      requestLimit: scrapeRulesLimit(rules) + SCRAPE_SOURCE_MAX_LIST_PAGES,
    })
    .returning();
  if (!run) throw new Error("Failed to create source run.");
  await connection.insert(scrapeSourceRuns).values({
    externalSiteRunId: run.id,
    scrapeSourceId: source.id,
    revisionId: revision.id,
    purpose: input.purpose,
  });
  return { run, source, revision };
}

export async function createScrapeSourceSuggestionRun(input: {
  scrapeSourceId: number;
  requestedById: number;
}) {
  return await db.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(scrapeSources)
      .where(eq(scrapeSources.id, input.scrapeSourceId))
      .for("update");
    if (!source) throw new ScrapeSourceNotFoundError();
    const [latestRevision] = await tx
      .select({
        previewStatus: scrapeSourceRevisions.previewStatus,
      })
      .from(scrapeSourceRevisions)
      .where(eq(scrapeSourceRevisions.scrapeSourceId, source.id))
      .orderBy(desc(scrapeSourceRevisions.revision))
      .limit(1);
    if (latestRevision && latestRevision.previewStatus !== "failed") {
      throw new ScrapeSourceValidationError(
        "AI repair is available only after the latest preview fails.",
      );
    }
    const [run] = await tx
      .insert(externalSiteRuns)
      .values({
        externalSiteId: source.externalSiteId,
        trigger: "manual",
        requestedById: input.requestedById,
        requestLimit: suggestionRequestLimit(source.sampleUrls.length),
      })
      .returning();
    if (!run) throw new Error("Failed to create AI suggestion run.");
    await tx.insert(scrapeSourceRuns).values({
      externalSiteRunId: run.id,
      scrapeSourceId: source.id,
      revisionId: null,
      purpose: "suggest",
    });
    return run;
  });
}
