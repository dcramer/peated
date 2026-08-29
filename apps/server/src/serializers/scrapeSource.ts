import type { z } from "zod";
import { serializer } from ".";
import type {
  ExternalSite,
  ScrapeSource,
  ScrapeSourceRevision,
} from "../db/schema";
import type {
  ScrapeSourceRevisionSchema,
  ScrapeSourceSchema,
} from "../schemas";
import { ScrapeSourcePreviewResultSchema } from "../scraper/configured/preview";
import { parseScrapeRules } from "../scraper/configured/rules";
import { serializeExternalSite } from "./externalSite";

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

function revisionItem(
  revision: ScrapeSourceRevision,
): z.infer<typeof ScrapeSourceRevisionSchema> {
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

export const ScrapeSourceRevisionSerializer = serializer({
  name: "scrapeSourceRevision",
  item: revisionItem,
});

type ScrapeSourceView = {
  source: ScrapeSource;
  site: ExternalSite;
  revisions: ScrapeSourceRevision[];
};

export const ScrapeSourceSerializer = serializer({
  name: "scrapeSource",
  item: ({
    source,
    site,
    revisions,
  }: ScrapeSourceView): z.infer<typeof ScrapeSourceSchema> => {
    return {
      id: source.id,
      site: serializeExternalSite(site),
      kind: source.kind,
      enabled: source.enabled,
      listUrl: source.listUrl,
      sampleUrls: source.sampleUrls,
      activeRevisionId:
        revisions.find((revision) => revision.active)?.id ?? null,
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
      revisions: revisions.map(revisionItem),
    };
  },
});
