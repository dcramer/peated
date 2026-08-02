import type OpenAI from "openai";
import {
  BottleContextSchema,
  BottleContextSourceSchema,
  type BottleContext,
  type BottleContextSource,
} from "../bottleContextContract";
import {
  BottleCandidateSchema,
  type BottleCandidate,
  type BottleExtractedDetails,
} from "../classifierTypes";
import { createWhiskyLabelExtractor } from "../extractor";
import type { OpenAIReasoningEffort } from "../openaiModelSettings";

type BottleContextLoaderDataSource = {
  getBottleContext?: (bottleId: number) => Promise<BottleContextSource | null>;
};

type BottleContextLoaderOptions = {
  client: OpenAI;
  model: string;
  reasoningEffort?: OpenAIReasoningEffort;
  overrides?: {
    extractFromImage?: (
      imageUrlOrBase64: string,
    ) => Promise<BottleExtractedDetails | null>;
  };
};

export function bottleContextToCandidate(
  context: BottleContext,
): BottleCandidate {
  return BottleCandidateSchema.parse({
    bottleId: context.bottleId,
    alias: null,
    fullName: context.fullName,
    brand: context.shared.brand.name,
    bottler: context.shared.bottler?.name ?? null,
    series: context.shared.series?.name ?? null,
    distillery: context.shared.distillers.map(({ name }) => name),
    category: context.shared.category,
    statedAge: context.exact.statedAge ?? context.shared.statedAge,
    edition: context.exact.edition,
    caskStrength: context.exact.caskStrength,
    singleCask: context.exact.singleCask,
    caskType: context.exact.caskType,
    caskSize: context.exact.caskSize,
    caskFill: context.exact.caskFill,
    abv: context.exact.abv,
    vintageYear: context.exact.vintageYear,
    releaseYear: context.exact.releaseYear,
    score: 1,
    source: ["context"],
  });
}

export function createBottleContextLoader({
  dataSource,
  options,
}: {
  dataSource: BottleContextLoaderDataSource;
  options: BottleContextLoaderOptions;
}) {
  if (!dataSource.getBottleContext) {
    return null;
  }
  const getBottleContext = dataSource.getBottleContext;

  const extractor = createWhiskyLabelExtractor({
    client: options.client,
    model: options.model,
    reasoningEffort: options.reasoningEffort,
  });
  const extractFromImage = async (imageUrl: string) =>
    options.overrides?.extractFromImage
      ? await options.overrides.extractFromImage(imageUrl)
      : await extractor.extractFromImage(imageUrl);

  return async (bottleId: number): Promise<BottleContext | null> => {
    const rawContext = await getBottleContext(bottleId);
    if (!rawContext) {
      return null;
    }
    const { imageSources, ...context } =
      BottleContextSourceSchema.parse(rawContext);
    const publicImages = await Promise.all(
      imageSources.map(async (imageSource) => {
        let extractedIdentity: BottleExtractedDetails | null = null;
        try {
          extractedIdentity = await extractFromImage(imageSource.url);
        } catch {
          extractedIdentity = null;
        }
        const sourceImageId =
          imageSource.source.kind === "bottle"
            ? `bottle:${bottleId}`
            : `tasting:${imageSource.source.tastingId}`;

        return {
          ...imageSource,
          labelEvidence: {
            sourceImageId,
            model: options.model,
            extractedIdentity,
          },
        };
      }),
    );

    return BottleContextSchema.parse({
      ...context,
      publicImages,
    });
  };
}
