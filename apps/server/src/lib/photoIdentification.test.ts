import {
  createPendingImageUpload,
  PENDING_UPLOAD_NAMESPACE,
} from "@peated/server/lib/pendingUploads";
import { getPhotoExtractionImageInput } from "@peated/server/lib/photoIdentification";
import { compressAndResizeImage } from "@peated/server/lib/uploads";

describe("photo identification", () => {
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
