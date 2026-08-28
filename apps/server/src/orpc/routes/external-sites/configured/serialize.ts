import type {
  ConfiguredScraper,
  ConfiguredScraperConfigVersion,
  ExternalSite,
} from "@peated/server/db/schema";
import { ConfiguredScraperConfigSchema } from "@peated/server/scraper/configured/config";
import { ConfiguredScraperValidationSchema } from "@peated/server/scraper/configured/validation";
import { serializeExternalSite } from "@peated/server/serializers/externalSite";

function serializeVersionCreation(version: ConfiguredScraperConfigVersion) {
  if (version.origin === "manual") {
    return {
      createdWith: "person" as const,
      model: null,
      promptVersion: null,
    };
  }
  if (version.model === null || version.promptVersion === null) {
    throw new Error("AI-created parsing rules have missing details.");
  }
  return {
    createdWith: "ai" as const,
    model: version.model,
    promptVersion: version.promptVersion,
  };
}

export function serializeConfiguredVersion(
  version: ConfiguredScraperConfigVersion,
) {
  return {
    id: version.id,
    configuredScraperId: version.configuredScraperId,
    version: version.version,
    config: ConfiguredScraperConfigSchema.parse(version.config),
    ...serializeVersionCreation(version),
    engineVersion: version.engineVersion,
    validationStatus: version.validationStatus,
    validationResult: ConfiguredScraperValidationSchema.parse(
      version.validationResult,
    ),
    validatedAt: version.validatedAt?.toISOString() ?? null,
    createdAt: version.createdAt.toISOString(),
  };
}

export function serializeConfiguredScraper(
  scraper: ConfiguredScraper,
  site: ExternalSite,
  versions: ConfiguredScraperConfigVersion[],
) {
  return {
    id: scraper.id,
    site: serializeExternalSite(site),
    collection: scraper.collection,
    enabled: scraper.enabled,
    allowLlmProcessing: scraper.allowLlmProcessing,
    indexUrl: scraper.indexUrl,
    sampleUrls: scraper.sampleUrls,
    activeConfigVersionId: scraper.activeConfigVersionId,
    createdAt: scraper.createdAt.toISOString(),
    updatedAt: scraper.updatedAt.toISOString(),
    versions: versions.map(serializeConfiguredVersion),
  };
}
