import { db } from "@peated/server/db";
import {
  externalReviewSourcePolicies,
  externalSiteRuns,
  externalSites,
  externalSiteScrapeTargets,
  scrapeOrigins,
  scrapeSourceRevisions,
  scrapeSourceRuns,
  scrapeSources,
  scrapeTargets,
} from "@peated/server/db/schema";
import {
  ScrapeSourceCreateSchema,
  ScrapeSourceUrlSchema,
} from "@peated/server/schemas";
import { ExternalSiteKeySchema } from "@peated/server/schemas/externalSites";
import slugify from "@sindresorhus/slugify";
import { and, desc, eq, max } from "drizzle-orm";
import { z } from "zod";
import { DEFAULT_SCRAPER_REQUEST_POLICY } from "../definitions";
import type { ScrapeSourcePreviewResult } from "./preview";
import {
  SCRAPE_RULES_VERSION,
  type ScrapeRules,
  ScrapeRulesSchema,
} from "./rules";

const CreateScrapeSourceInputSchema = ScrapeSourceCreateSchema.extend({
  createdById: z.number().int().positive(),
}).strict();

export type CreateScrapeSourceInput = z.input<
  typeof CreateScrapeSourceInputSchema
>;

export class ScrapeSourceConflictError extends Error {
  override name = "ScrapeSourceConflictError";
}

export class ScrapeSourceNotFoundError extends Error {
  override name = "ScrapeSourceNotFoundError";
}

export class ScrapeSourceValidationError extends Error {
  override name = "ScrapeSourceValidationError";
}

const DatabaseErrorSchema = z.object({ code: z.string() });

function exactOrigin(url: URL) {
  if (url.username || url.password) {
    throw new ScrapeSourceValidationError(
      "Source URLs cannot contain credentials.",
    );
  }
  return url.origin;
}

export function createSiteKey(websiteUrl: URL) {
  const hostname = websiteUrl.host.replace(/^www\./, "");
  const key = slugify(hostname).slice(0, 64).replace(/-+$/, "");
  return ExternalSiteKeySchema.parse(key);
}

export async function createSiteWithScrapeSource(
  rawInput: CreateScrapeSourceInput,
) {
  const input = CreateScrapeSourceInputSchema.parse(rawInput);
  const listUrl = new URL(input.websiteUrl);
  const origin = exactOrigin(listUrl);
  const key = createSiteKey(listUrl);
  for (const sample of input.sampleUrls) {
    if (exactOrigin(new URL(sample)) !== origin) {
      throw new ScrapeSourceValidationError(
        "Example pages must use the source website.",
      );
    }
  }

  try {
    return await db.transaction(async (tx) => {
      const [site] = await tx
        .insert(externalSites)
        .values({ type: key, name: input.name, runEvery: null })
        .returning();
      if (!site) throw new Error("Failed to create external site.");

      await tx.insert(scrapeTargets).values({
        key,
        managedBy: "admin",
        enabled: true,
        minimumSpacingMs: DEFAULT_SCRAPER_REQUEST_POLICY.minimumSpacingMs,
        requestsPerWindow: DEFAULT_SCRAPER_REQUEST_POLICY.requestsPerWindow,
        windowMs: DEFAULT_SCRAPER_REQUEST_POLICY.windowMs,
        timeoutMs: DEFAULT_SCRAPER_REQUEST_POLICY.timeoutMs,
        maxResponseBytes: DEFAULT_SCRAPER_REQUEST_POLICY.maxResponseBytes,
        maxRetries: DEFAULT_SCRAPER_REQUEST_POLICY.maxRetries,
      });
      await tx.insert(scrapeOrigins).values({
        origin,
        managedBy: "admin",
        targetKey: key,
        robotsMode: "enforce",
      });
      await tx.insert(externalSiteScrapeTargets).values({
        externalSiteId: site.id,
        targetKey: key,
        managedBy: "admin",
      });
      const [source] = await tx
        .insert(scrapeSources)
        .values({
          externalSiteId: site.id,
          kind: input.kind,
          listUrl: listUrl.toString(),
          sampleUrls: input.sampleUrls.map((value) =>
            new URL(value).toString(),
          ),
          createdById: input.createdById,
        })
        .returning();
      if (!source) throw new Error("Failed to create scrape source.");
      if (input.kind === "review") {
        await tx.insert(externalReviewSourcePolicies).values({
          externalSiteId: site.id,
          publicationMode: "disabled",
          allowLlmProcessing: false,
          allowScoreDisplay: false,
          allowSummaryDisplay: false,
        });
      }
      return { site, source };
    });
  } catch (error) {
    if (DatabaseErrorSchema.safeParse(error).data?.code === "23505") {
      throw new ScrapeSourceConflictError(
        "A source for this website already exists.",
      );
    }
    throw error;
  }
}

export type CreateScrapeSourceRevisionInput = {
  scrapeSourceId: number;
  listUrl?: string;
  rules: ScrapeRules;
  createdById: number;
} & (
  | { author: "person" }
  | { author: "ai"; aiModel: string; aiInstructionsVersion: string }
);

export async function createScrapeSourceRevision(
  input: CreateScrapeSourceRevisionInput,
) {
  const rules = ScrapeRulesSchema.parse(input.rules);
  return await db.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(scrapeSources)
      .where(eq(scrapeSources.id, input.scrapeSourceId))
      .for("update");
    if (!source) throw new ScrapeSourceNotFoundError();
    const listUrl = ScrapeSourceUrlSchema.parse(
      input.listUrl ?? source.listUrl,
    );
    if (
      exactOrigin(new URL(listUrl)) !== exactOrigin(new URL(source.listUrl))
    ) {
      throw new ScrapeSourceValidationError(
        "The list page must stay on the source website.",
      );
    }
    if (source.kind !== rules.kind) {
      throw new ScrapeSourceValidationError(
        "The parsing rules collect the wrong content.",
      );
    }
    const [latest] = await tx
      .select({ revision: max(scrapeSourceRevisions.revision) })
      .from(scrapeSourceRevisions)
      .where(eq(scrapeSourceRevisions.scrapeSourceId, source.id));
    const [revision] = await tx
      .insert(scrapeSourceRevisions)
      .values({
        scrapeSourceId: source.id,
        revision: (latest?.revision ?? 0) + 1,
        rulesVersion: SCRAPE_RULES_VERSION,
        listUrl: new URL(listUrl).toString(),
        rules,
        author: input.author,
        aiModel: input.author === "ai" ? input.aiModel : null,
        aiInstructionsVersion:
          input.author === "ai" ? input.aiInstructionsVersion : null,
        previewResult: { issues: [], pages: [] },
        createdById: input.createdById,
      })
      .returning();
    if (!revision) throw new Error("Failed to create parsing-rule revision.");
    return revision;
  });
}

export async function listScrapeSources(siteKey?: string) {
  const query = db
    .select({ source: scrapeSources, site: externalSites })
    .from(scrapeSources)
    .innerJoin(
      externalSites,
      eq(externalSites.id, scrapeSources.externalSiteId),
    );
  return siteKey
    ? await query.where(eq(externalSites.type, siteKey))
    : await query.orderBy(externalSites.name, scrapeSources.kind);
}

export async function listScrapeSourceRevisions(scrapeSourceId: number) {
  return await db
    .select()
    .from(scrapeSourceRevisions)
    .where(eq(scrapeSourceRevisions.scrapeSourceId, scrapeSourceId))
    .orderBy(desc(scrapeSourceRevisions.revision));
}

export async function getLatestScrapeSourceSetup(scrapeSourceId: number) {
  const [setup] = await db
    .select({ run: externalSiteRuns })
    .from(scrapeSourceRuns)
    .innerJoin(
      externalSiteRuns,
      eq(externalSiteRuns.id, scrapeSourceRuns.externalSiteRunId),
    )
    .where(
      and(
        eq(scrapeSourceRuns.scrapeSourceId, scrapeSourceId),
        eq(scrapeSourceRuns.purpose, "suggest"),
      ),
    )
    .orderBy(desc(externalSiteRuns.createdAt))
    .limit(1);
  return setup?.run ?? null;
}

export async function recordScrapeSourcePreview(input: {
  revisionId: number;
  status: "passed" | "failed";
  result: ScrapeSourcePreviewResult;
}) {
  const [revision] = await db
    .update(scrapeSourceRevisions)
    .set({
      previewStatus: input.status,
      previewResult: input.result,
      previewedAt: new Date(),
    })
    .where(eq(scrapeSourceRevisions.id, input.revisionId))
    .returning();
  if (!revision) throw new ScrapeSourceNotFoundError();
  return revision;
}

export async function activateScrapeSourceRevision(input: {
  scrapeSourceId: number;
  revisionId: number;
}) {
  return await db.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(scrapeSources)
      .where(eq(scrapeSources.id, input.scrapeSourceId))
      .for("update");
    if (!source) throw new ScrapeSourceNotFoundError();

    const [revision] = await tx
      .select()
      .from(scrapeSourceRevisions)
      .where(
        and(
          eq(scrapeSourceRevisions.id, input.revisionId),
          eq(scrapeSourceRevisions.scrapeSourceId, source.id),
        ),
      );
    if (!revision) throw new ScrapeSourceNotFoundError();
    if (revision.previewStatus !== "passed") {
      throw new ScrapeSourceValidationError(
        "Preview this revision successfully before you activate it.",
      );
    }

    await tx
      .update(scrapeSourceRevisions)
      .set({ active: false })
      .where(
        and(
          eq(scrapeSourceRevisions.scrapeSourceId, source.id),
          eq(scrapeSourceRevisions.active, true),
        ),
      );
    const [activeRevision] = await tx
      .update(scrapeSourceRevisions)
      .set({ active: true })
      .where(eq(scrapeSourceRevisions.id, revision.id))
      .returning();
    if (!activeRevision) throw new ScrapeSourceNotFoundError();

    const [enabledSource] = await tx
      .update(scrapeSources)
      .set({
        enabled: true,
        listUrl: activeRevision.listUrl,
        updatedAt: new Date(),
      })
      .where(eq(scrapeSources.id, source.id))
      .returning();
    if (!enabledSource) throw new ScrapeSourceNotFoundError();
    return { source: enabledSource, revision: activeRevision };
  });
}

export async function pauseScrapeSource(scrapeSourceId: number) {
  const [source] = await db
    .update(scrapeSources)
    .set({ enabled: false, updatedAt: new Date() })
    .where(eq(scrapeSources.id, scrapeSourceId))
    .returning();
  if (!source) throw new ScrapeSourceNotFoundError();
  return source;
}
