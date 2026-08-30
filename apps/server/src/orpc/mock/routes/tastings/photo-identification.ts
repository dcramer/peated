import {
  mockBottleDetailsFor,
  mockBottleDetailsList,
  mockImageUrls,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.tastings.photoIdentification.handler(
  async ({ input, context, errors }) => {
    if (!context.user) throw errors.UNAUTHORIZED();

    const bottle = mockBottleDetailsList[0];
    if (!bottle) {
      throw errors.NOT_FOUND({ message: "Mock bottle not found." });
    }

    const matchedBottle = mockBottleDetailsFor(context.user, bottle);
    const pendingImageId = `mock-${input.idempotencyKey}`;

    return {
      pendingImage: {
        id: pendingImageId,
        imageUrl: mockImageUrls.cairdeasWarehouse1,
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
      imageEvidence: {
        sourceImageId: pendingImageId,
        extractors: [
          {
            kind: "vision",
            model: "peated-mock-label-reader",
            confidence: 0.96,
            textSpans: [{ text: matchedBottle.fullName, confidence: 0.96 }],
            observations: ["Readable front label."],
          },
        ],
        fieldCandidates: {
          brand: {
            value: matchedBottle.brand.name,
            confidence: 0.96,
            sourceExtractorIndexes: [0],
          },
          expression: {
            value: matchedBottle.name,
            confidence: 0.96,
            sourceExtractorIndexes: [0],
          },
          category: matchedBottle.category
            ? {
                value: matchedBottle.category,
                confidence: 0.92,
                sourceExtractorIndexes: [0],
              }
            : undefined,
          statedAge:
            matchedBottle.statedAge === null
              ? undefined
              : {
                  value: matchedBottle.statedAge,
                  confidence: 0.94,
                  sourceExtractorIndexes: [0],
                },
          abv:
            matchedBottle.abv === null
              ? undefined
              : {
                  value: matchedBottle.abv,
                  confidence: 0.94,
                  sourceExtractorIndexes: [0],
                },
        },
        photoSuitability: {
          isSingleBottlePhoto: true,
          labelReadable: true,
          suitableAsTastingImage: true,
          suitableAsBottleImage: true,
        },
        conflicts: [],
      },
      classification: {
        status: "classified",
        decision: {
          action: "match",
          matchedBottle,
        },
        artifacts: {
          candidates: [{ fullName: matchedBottle.fullName }],
        },
      },
      suggestedNextStep: "confirm_match",
      diagnostics: {
        extraction: {
          status: "found",
          summary: "Read the bottle name, age, and strength.",
        },
        candidates: { count: 1 },
        classification: {
          status: "classified",
          action: "match",
          confidence: 0.96,
          reason: "Mock exact label match.",
        },
      },
      createToken: null,
    };
  },
);
