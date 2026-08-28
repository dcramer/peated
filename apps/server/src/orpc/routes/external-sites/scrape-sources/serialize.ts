import type {
  ExternalSite,
  ScrapeSource,
  ScrapeSourceRevision,
} from "@peated/server/db/schema";
import { parseScrapeRules } from "@peated/server/scraper/configured/config";
import { ScrapeSourceValidationSchema } from "@peated/server/scraper/configured/validation";
import { serializeExternalSite } from "@peated/server/serializers/externalSite";

function serializeRevisionCreation(revision: ScrapeSourceRevision) {
  if (revision.createdWith === "person") {
    return {
      createdWith: "person" as const,
      model: null,
      promptVersion: null,
    };
  }
  if (revision.model === null || revision.promptVersion === null) {
    throw new Error("AI-created parsing rules have missing details.");
  }
  return {
    createdWith: "ai" as const,
    model: revision.model,
    promptVersion: revision.promptVersion,
  };
}

export function serializeScrapeSourceRevision(revision: ScrapeSourceRevision) {
  return {
    id: revision.id,
    scrapeSourceId: revision.scrapeSourceId,
    revision: revision.revision,
    formatVersion: revision.formatVersion,
    listUrl: revision.listUrl,
    rules: parseScrapeRules(revision.formatVersion, revision.rules),
    active: revision.active,
    ...serializeRevisionCreation(revision),
    validationStatus: revision.validationStatus,
    validationResult: ScrapeSourceValidationSchema.parse(
      revision.validationResult,
    ),
    validatedAt: revision.validatedAt?.toISOString() ?? null,
    createdAt: revision.createdAt.toISOString(),
  };
}

export function serializeScrapeSource(
  source: ScrapeSource,
  site: ExternalSite,
  revisions: ScrapeSourceRevision[],
) {
  return {
    id: source.id,
    site: serializeExternalSite(site),
    kind: source.kind,
    enabled: source.enabled,
    allowLlmProcessing: source.allowLlmProcessing,
    listUrl: source.listUrl,
    sampleUrls: source.sampleUrls,
    activeRevisionId: revisions.find((revision) => revision.active)?.id ?? null,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
    revisions: revisions.map(serializeScrapeSourceRevision),
  };
}
