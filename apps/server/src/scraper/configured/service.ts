import { db } from "@peated/server/db";
import {
  configuredScraperConfigVersions,
  configuredScrapers,
  externalReviewSourcePolicies,
  externalSites,
  externalSiteScrapeTargets,
  scrapeOrigins,
  scrapeTargets,
} from "@peated/server/db/schema";
import { ExternalSiteKeySchema } from "@peated/server/schemas";
import { and, desc, eq, max } from "drizzle-orm";
import { z } from "zod";
import { DEFAULT_SCRAPER_REQUEST_POLICY } from "../definitions";
import {
  CONFIGURED_SCRAPER_ENGINE_VERSION,
  type ConfiguredScraperConfig,
  ConfiguredScraperConfigSchema,
} from "./config";
import type { ConfiguredScraperValidation } from "./validation";

const HttpUrlSchema = z
  .url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
    message: "URL must use HTTP or HTTPS.",
  });

const CreateSiteInputSchema = z
  .object({
    key: ExternalSiteKeySchema,
    name: z.string().trim().min(1).max(200),
    collection: z.enum(["reviews", "store_prices"]),
    indexUrl: HttpUrlSchema,
    sampleUrls: z.array(HttpUrlSchema).max(10).default([]),
    allowLlmProcessing: z.boolean().default(false),
    createdById: z.number().int().positive(),
  })
  .strict();

export type CreateConfiguredScraperSiteInput = z.input<
  typeof CreateSiteInputSchema
>;

export class ConfiguredScraperConflictError extends Error {
  override name = "ConfiguredScraperConflictError";
}

export class ConfiguredScraperNotFoundError extends Error {
  override name = "ConfiguredScraperNotFoundError";
}

export class ConfiguredScraperValidationError extends Error {
  override name = "ConfiguredScraperValidationError";
}

const DatabaseErrorSchema = z.object({ code: z.string() });

function exactOrigin(url: URL) {
  if (url.username || url.password) {
    throw new ConfiguredScraperValidationError(
      "Source URLs cannot contain credentials.",
    );
  }
  return url.origin;
}

export async function createConfiguredScraperSite(
  rawInput: CreateConfiguredScraperSiteInput,
) {
  const input = CreateSiteInputSchema.parse(rawInput);
  const indexUrl = new URL(input.indexUrl);
  const origin = exactOrigin(indexUrl);
  for (const sample of input.sampleUrls) {
    if (exactOrigin(new URL(sample)) !== origin) {
      throw new ConfiguredScraperValidationError(
        "Example pages must use the same website as the list page.",
      );
    }
  }

  try {
    return await db.transaction(async (tx) => {
      const [site] = await tx
        .insert(externalSites)
        .values({ type: input.key, name: input.name, runEvery: null })
        .returning();
      if (!site) throw new Error("Failed to create external site.");

      await tx.insert(scrapeTargets).values({
        key: input.key,
        owner: "admin",
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
        owner: "admin",
        targetKey: input.key,
        robotsMode: "enforce",
      });
      await tx.insert(externalSiteScrapeTargets).values({
        externalSiteId: site.id,
        targetKey: input.key,
        owner: "admin",
      });
      const [scraper] = await tx
        .insert(configuredScrapers)
        .values({
          externalSiteId: site.id,
          collection: input.collection,
          indexUrl: indexUrl.toString(),
          sampleUrls: input.sampleUrls.map((value) =>
            new URL(value).toString(),
          ),
          allowLlmProcessing: input.allowLlmProcessing,
          createdById: input.createdById,
        })
        .returning();
      if (!scraper) throw new Error("Failed to create source parsing rules.");
      if (input.collection === "reviews") {
        await tx.insert(externalReviewSourcePolicies).values({
          externalSiteId: site.id,
          publicationMode: "disabled",
          allowLlmProcessing: false,
          allowScoreDisplay: false,
          allowSummaryDisplay: false,
        });
      }
      return { site, scraper };
    });
  } catch (error) {
    if (DatabaseErrorSchema.safeParse(error).data?.code === "23505") {
      throw new ConfiguredScraperConflictError(
        "A source with this short name already exists.",
      );
    }
    throw error;
  }
}

export type CreateConfiguredScraperDraftInput = {
  configuredScraperId: number;
  config: ConfiguredScraperConfig;
  createdById: number;
} & (
  | { createdWith: "person" }
  | { createdWith: "ai"; model: string; promptVersion: string }
);

export async function createConfiguredScraperDraft(
  input: CreateConfiguredScraperDraftInput,
) {
  const config = ConfiguredScraperConfigSchema.parse(input.config);
  return await db.transaction(async (tx) => {
    const [scraper] = await tx
      .select()
      .from(configuredScrapers)
      .where(eq(configuredScrapers.id, input.configuredScraperId))
      .for("update");
    if (!scraper) throw new ConfiguredScraperNotFoundError();
    if (scraper.collection !== config.collection) {
      throw new ConfiguredScraperValidationError(
        "The parsing rules collect the wrong content.",
      );
    }
    if (input.createdWith === "ai" && !scraper.allowLlmProcessing) {
      throw new ConfiguredScraperValidationError(
        "AI suggestions are not allowed for this source.",
      );
    }
    const [latest] = await tx
      .select({ version: max(configuredScraperConfigVersions.version) })
      .from(configuredScraperConfigVersions)
      .where(
        eq(configuredScraperConfigVersions.configuredScraperId, scraper.id),
      );
    const [version] = await tx
      .insert(configuredScraperConfigVersions)
      .values({
        configuredScraperId: scraper.id,
        version: (latest?.version ?? 0) + 1,
        config,
        origin: input.createdWith === "ai" ? "llm" : "manual",
        model: input.createdWith === "ai" ? input.model : null,
        promptVersion: input.createdWith === "ai" ? input.promptVersion : null,
        engineVersion: CONFIGURED_SCRAPER_ENGINE_VERSION,
        validationResult: { issues: [], pages: [] },
        createdById: input.createdById,
      })
      .returning();
    if (!version) throw new Error("Failed to create parsing-rule version.");
    return version;
  });
}

export async function listConfiguredScrapers(siteKey?: string) {
  const query = db
    .select({ scraper: configuredScrapers, site: externalSites })
    .from(configuredScrapers)
    .innerJoin(
      externalSites,
      eq(externalSites.id, configuredScrapers.externalSiteId),
    );
  return siteKey
    ? await query.where(eq(externalSites.type, siteKey))
    : await query.orderBy(externalSites.name, configuredScrapers.collection);
}

export async function listConfiguredScraperVersions(
  configuredScraperId: number,
) {
  return await db
    .select()
    .from(configuredScraperConfigVersions)
    .where(
      eq(
        configuredScraperConfigVersions.configuredScraperId,
        configuredScraperId,
      ),
    )
    .orderBy(desc(configuredScraperConfigVersions.version));
}

export async function recordConfiguredScraperValidation(input: {
  configVersionId: number;
  status: "passed" | "failed";
  result: ConfiguredScraperValidation;
}) {
  const [version] = await db
    .update(configuredScraperConfigVersions)
    .set({
      validationStatus: input.status,
      validationResult: input.result,
      validatedAt: new Date(),
    })
    .where(eq(configuredScraperConfigVersions.id, input.configVersionId))
    .returning();
  if (!version) throw new ConfiguredScraperNotFoundError();
  return version;
}

export async function activateConfiguredScraperVersion(input: {
  configuredScraperId: number;
  configVersionId: number;
}) {
  return await db.transaction(async (tx) => {
    const [version] = await tx
      .select()
      .from(configuredScraperConfigVersions)
      .where(
        and(
          eq(configuredScraperConfigVersions.id, input.configVersionId),
          eq(
            configuredScraperConfigVersions.configuredScraperId,
            input.configuredScraperId,
          ),
        ),
      )
      .for("update");
    if (!version) throw new ConfiguredScraperNotFoundError();
    if (version.validationStatus !== "passed") {
      throw new ConfiguredScraperValidationError(
        "Test this version successfully before you activate it.",
      );
    }
    const [scraper] = await tx
      .update(configuredScrapers)
      .set({
        activeConfigVersionId: version.id,
        enabled: true,
        updatedAt: new Date(),
      })
      .where(eq(configuredScrapers.id, input.configuredScraperId))
      .returning();
    if (!scraper) throw new ConfiguredScraperNotFoundError();
    return { scraper, version };
  });
}

export async function disableConfiguredScraper(configuredScraperId: number) {
  const [scraper] = await db
    .update(configuredScrapers)
    .set({ enabled: false, updatedAt: new Date() })
    .where(eq(configuredScrapers.id, configuredScraperId))
    .returning();
  if (!scraper) throw new ConfiguredScraperNotFoundError();
  return scraper;
}
