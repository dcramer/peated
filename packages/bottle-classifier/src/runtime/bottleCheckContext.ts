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
  getBottleContextImageInput?: (imageUrl: string) => Promise<string>;
};

type BottleContextLoaderOptions = {
  client: OpenAI;
  model: string;
  reasoningEffort?: OpenAIReasoningEffort;
  imageExtractionModel?: string;
  imageExtractionReasoningEffort?: OpenAIReasoningEffort;
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
    maturation: context.exact.maturation,
    caskNumber: context.exact.caskNumber,
    outturn: context.exact.outturn,
    abv: context.exact.abv,
    vintageYear: context.exact.vintageYear,
    bottlingYear: context.exact.bottlingYear,
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
    imageModel: options.imageExtractionModel,
    imageReasoningEffort: options.imageExtractionReasoningEffort,
  });
  const extractLabelEvidence = async (imageUrl: string) => {
    if (options.overrides?.extractFromImage) {
      return {
        extractedIdentity: await options.overrides.extractFromImage(imageUrl),
        rawLabelText: null,
      };
    }
    const extraction = await extractor.extractFromImageWithMetadata(imageUrl);
    return {
      extractedIdentity: extraction.result,
      rawLabelText: extraction.rawLabelText,
    };
  };

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
        let rawLabelText: string | null = null;
        try {
          const imageInput = dataSource.getBottleContextImageInput
            ? await dataSource.getBottleContextImageInput(imageSource.url)
            : imageSource.url;
          ({ extractedIdentity, rawLabelText } =
            await extractLabelEvidence(imageInput));
        } catch {
          extractedIdentity = null;
          rawLabelText = null;
        }
        const sourceImageId =
          imageSource.source.kind === "bottle"
            ? `bottle:${bottleId}`
            : `tasting:${imageSource.source.tastingId}`;

        return {
          ...imageSource,
          labelEvidence: {
            sourceImageId,
            model: options.imageExtractionModel ?? options.model,
            extractedIdentity,
            rawLabelText,
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
