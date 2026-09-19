import { imageUploadSpec } from "@peated/server/openapi/image-upload";
import {
  PhotoIdentificationInputSchema,
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
      "Upload a temporary bottle photo, extract label evidence, and classify the likely bottle without creating a tasting.",
    operationId: "identifyTastingBottleFromPhoto",
    spec: imageUploadSpec,
  })
  .input(PhotoIdentificationInputSchema)
  .output(PhotoIdentificationSchema);
