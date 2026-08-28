import type {
  ExternalSite,
  ScrapeSource,
  ScrapeSourceRevision,
} from "@peated/server/db/schema";
import { parseScrapeRules } from "@peated/server/scraper/configured/config";
import { ScrapeSourcePreviewResultSchema } from "@peated/server/scraper/configured/preview";
import { serializeExternalSite } from "@peated/server/serializers/externalSite";

function serializeRevisionAuthor(revision: ScrapeSourceRevision) {
  if (revision.author === "person") {
    return {
      author: "person" as const,
      aiModel: null,
      aiInstructionsVersion: null,
    };
  }
  if (revision.aiModel === null || revision.aiInstructionsVersion === null) {
    throw new Error("AI-created parsing rules have missing details.");
  }
  return {
    author: "ai" as const,
    aiModel: revision.aiModel,
    aiInstructionsVersion: revision.aiInstructionsVersion,
  };
}

export function serializeScrapeSourceRevision(revision: ScrapeSourceRevision) {
  return {
    id: revision.id,
    scrapeSourceId: revision.scrapeSourceId,
    revision: revision.revision,
    rulesVersion: revision.rulesVersion,
    listUrl: revision.listUrl,
    rules: parseScrapeRules(revision.rulesVersion, revision.rules),
    active: revision.active,
    ...serializeRevisionAuthor(revision),
    previewStatus: revision.previewStatus,
    previewResult: ScrapeSourcePreviewResultSchema.parse(
      revision.previewResult,
    ),
    previewedAt: revision.previewedAt?.toISOString() ?? null,
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
    allowAiSuggestions: source.allowAiSuggestions,
    listUrl: source.listUrl,
    sampleUrls: source.sampleUrls,
    activeRevisionId: revisions.find((revision) => revision.active)?.id ?? null,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
    revisions: revisions.map(serializeScrapeSourceRevision),
  };
}
