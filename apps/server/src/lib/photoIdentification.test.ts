import { BottleExtractedDetailsSchema } from "@peated/server/agents/bottleClassifier";
import {
  createPendingImageUpload,
  PENDING_UPLOAD_NAMESPACE,
} from "@peated/server/lib/pendingUploads";
import {
  buildPhotoEvidenceFromExtractedIdentity,
  getPhotoExtractionImageInput,
} from "@peated/server/lib/photoIdentification";
import { compressAndResizeImage } from "@peated/server/lib/uploads";

describe("photo identification", () => {
  test("preserves raw label text as image evidence", () => {
    const imageEvidence = buildPhotoEvidenceFromExtractedIdentity({
      pendingUpload: {
        id: "pending-image",
        imageUrl: "https://example.com/bottle.jpg",
      },
      extractedIdentity: BottleExtractedDetailsSchema.parse({
        brand: "Example",
        expression: "Whisky",
        edition: null,
      }),
      rawLabelText: "Example Whisky. Batch No. 23J12.",
    });

    expect(imageEvidence.extractors[0]?.textSpans).toEqual([
      {
        text: "Example Whisky. Batch No. 23J12.",
        confidence: 0.75,
      },
    ]);
    expect(imageEvidence.fieldCandidates.edition).toBeUndefined();
  });

  test("uses a data URL for local pending image extraction", async ({
    defaults,
    fixtures,
  }) => {
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const imageInput = await getPhotoExtractionImageInput({ pendingUpload });

    expect(pendingUpload.imageUrl).toContain(
      `/uploads/${PENDING_UPLOAD_NAMESPACE}/`,
    );
    expect(imageInput).toMatch(/^data:image\/webp;base64,/);
  });
});
