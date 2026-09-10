import { db, type AnyDatabase } from "@peated/server/db";
import {
  externalSiteRuns,
  scrapeSourceRevisions,
  scrapeSourceRuns,
  scrapeSources,
} from "@peated/server/db/schema";
import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { ScraperRunTakenOverError } from "../session";
import { loadExecutableScrapeRules } from "./compatibility";
import { ScrapeIssueSchema, type ScrapeIssue } from "./preview";
import { SCRAPE_RULES_VERSION, SCRAPE_SOURCE_MAX_LIST_PAGES } from "./rules";
import {
  ScrapeSourceNotFoundError,
  ScrapeSourceValidationError,
} from "./service";
import { MAX_RULE_CHECKS, setupRequestLimit } from "./setupAgent";
import { ScrapeSourceSetupError } from "./setupError";

export const ScrapeSourceSuggestionCursorSchema = z.union([
  z.null(),
  z
    .object({
      repair: z
        .object({
          revisionId: z.number().int().positive(),
          pageUrl: z.url(),
          issues: z.array(ScrapeIssueSchema),
        })
        .strict()
        .optional(),
      modelCallCount: z.number().int().min(0).max(MAX_RULE_CHECKS).default(0),
    })
    .strict(),
]);

export type ScrapeSourceSuggestionCursor = z.infer<
  typeof ScrapeSourceSuggestionCursorSchema
>;

/** Setup counts calls before sending them so a resumed job keeps the same limit. */
export async function reserveScrapeSourceModelCall(
  runId: number,
  executionToken: string,
) {
  await db.transaction(async (tx) => {
    const [run] = await tx
      .select()
      .from(externalSiteRuns)
      .where(eq(externalSiteRuns.id, runId))
      .for("update");
    if (
      !run ||
      run.status !== "running" ||
      run.executionToken !== executionToken
    ) {
      throw new ScraperRunTakenOverError();
    }
    const cursor = ScrapeSourceSuggestionCursorSchema.parse(run.cursor);
    const count = cursor?.modelCallCount ?? 0;
    if (count >= MAX_RULE_CHECKS) {
      throw new ScrapeSourceSetupError(
        "The rule check limit was reached. Review the source before trying again.",
      );
    }
    await tx
      .update(externalSiteRuns)
      .set({ cursor: { ...cursor, modelCallCount: count + 1 } })
      .where(eq(externalSiteRuns.id, runId));
  });
}

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
  const rules = loadExecutableScrapeRules(
    revision.rulesVersion,
    revision.rules,
  );
  const [run] = await connection
    .insert(externalSiteRuns)
    .values({
      externalSiteId: source.externalSiteId,
      trigger: input.trigger,
      purpose: input.purpose,
      requestedById: input.requestedById,
      requestLimit: rules.limit + SCRAPE_SOURCE_MAX_LIST_PAGES,
      requestErrorCount: 0,
      recordType: rules.kind,
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
        rulesVersion: scrapeSourceRevisions.rulesVersion,
      })
      .from(scrapeSourceRevisions)
      .where(eq(scrapeSourceRevisions.scrapeSourceId, source.id))
      .orderBy(desc(scrapeSourceRevisions.revision))
      .limit(1);
    if (
      latestRevision &&
      latestRevision.rulesVersion === SCRAPE_RULES_VERSION &&
      latestRevision.previewStatus !== "failed"
    ) {
      throw new ScrapeSourceValidationError(
        "AI suggestions are available only when the saved rules need updating or the latest preview fails.",
      );
    }
    const [run] = await tx
      .insert(externalSiteRuns)
      .values({
        externalSiteId: source.externalSiteId,
        trigger: "manual",
        purpose: "suggest",
        requestedById: input.requestedById,
        requestLimit: setupRequestLimit(source.sampleUrls.length),
        requestErrorCount: 0,
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

/** Stops broken rules and allows one repair between successful collections. */
export async function createScrapeSourceRepairRun(
  connection: AnyDatabase,
  input: {
    failedRunId: number;
    pageUrl: string;
    issues: ScrapeIssue[];
    now: Date;
  },
) {
  const [sourceRun] = await connection
    .select({
      purpose: scrapeSourceRuns.purpose,
      revisionId: scrapeSourceRuns.revisionId,
      scrapeSourceId: scrapeSourceRuns.scrapeSourceId,
    })
    .from(scrapeSourceRuns)
    .where(eq(scrapeSourceRuns.externalSiteRunId, input.failedRunId));
  if (sourceRun?.purpose !== "collect" || sourceRun.revisionId === null) {
    return null;
  }

  const [source] = await connection
    .select()
    .from(scrapeSources)
    .where(eq(scrapeSources.id, sourceRun.scrapeSourceId))
    .for("update");
  if (!source?.enabled) return null;

  const [revision] = await connection
    .select()
    .from(scrapeSourceRevisions)
    .where(
      and(
        eq(scrapeSourceRevisions.id, sourceRun.revisionId),
        eq(scrapeSourceRevisions.scrapeSourceId, source.id),
        eq(scrapeSourceRevisions.active, true),
      ),
    );
  if (!revision) return null;

  await connection
    .update(scrapeSourceRevisions)
    .set({
      previewStatus: "failed",
      previewResult: {
        issues: input.issues,
        pages: revision.previewResult.pages,
      },
      previewedAt: input.now,
    })
    .where(eq(scrapeSourceRevisions.id, revision.id));

  // Repair eligibility belongs to the source. A new version or a passing preview
  // cannot restore it; only a complete collection proves the source recovered.
  const [lastRepairOrSuccess] = await connection
    .select({ purpose: scrapeSourceRuns.purpose })
    .from(scrapeSourceRuns)
    .innerJoin(
      externalSiteRuns,
      eq(externalSiteRuns.id, scrapeSourceRuns.externalSiteRunId),
    )
    .where(
      and(
        eq(scrapeSourceRuns.scrapeSourceId, source.id),
        or(
          and(
            eq(scrapeSourceRuns.purpose, "suggest"),
            eq(externalSiteRuns.trigger, "scheduled"),
          ),
          and(
            eq(scrapeSourceRuns.purpose, "collect"),
            eq(externalSiteRuns.status, "succeeded"),
          ),
        ),
      ),
    )
    .orderBy(desc(externalSiteRuns.id))
    .limit(1);
  if (lastRepairOrSuccess?.purpose === "suggest") return null;

  const cursor = ScrapeSourceSuggestionCursorSchema.parse({
    repair: {
      revisionId: revision.id,
      pageUrl: input.pageUrl,
      issues: input.issues,
    },
  });
  const [run] = await connection
    .insert(externalSiteRuns)
    .values({
      externalSiteId: source.externalSiteId,
      trigger: "scheduled",
      purpose: "suggest",
      requestLimit: setupRequestLimit(source.sampleUrls.length),
      requestErrorCount: 0,
      cursor,
      createdAt: input.now,
    })
    .returning();
  if (!run) throw new Error("Failed to create AI repair run.");
  await connection.insert(scrapeSourceRuns).values({
    externalSiteRunId: run.id,
    scrapeSourceId: source.id,
    revisionId: null,
    purpose: "suggest",
  });
  return run;
}
