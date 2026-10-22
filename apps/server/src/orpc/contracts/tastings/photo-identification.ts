import { eventIterator } from "@orpc/contract";
import { imageUploadSpec } from "@peated/server/openapi/image-upload";
import {
  PhotoIdentificationInputSchema,
  PhotoIdentificationProgressSchema,
  PhotoIdentificationSchema,
} from "@peated/server/schemas";
import { contract } from "../base";

export default contract
  .errors({
    SERVICE_UNAVAILABLE: {
      status: 503,
      message:
        "We can't check photos right now. Search by name or try again later.",
    },
  })
  .route({
    method: "POST",
    path: "/tastings/photo-identification",
    summary: "Identify tasting bottle from photo",
    description:
      "Upload a temporary bottle photo, extract label evidence, and classify the likely bottle without creating a tasting. The response is a stream of progress events (the stored photo, the label reading, likely Peated matches, and generic steps) that ends with the full result. Closing the stream stops the remaining work.",
    operationId: "identifyTastingBottleFromPhoto",
    spec: imageUploadSpec,
  })
  .input(PhotoIdentificationInputSchema)
  .output(
    eventIterator(PhotoIdentificationProgressSchema, PhotoIdentificationSchema),
  );
