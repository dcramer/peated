import config from "@peated/server/config";
import { MAX_FILESIZE } from "@peated/server/constants";
import { createPendingImageUpload } from "@peated/server/lib/pendingUploads";
import { humanizeBytes } from "@peated/server/lib/strings";
import { compressAndResizeImage } from "@peated/server/lib/uploads";
import { absoluteUrl } from "@peated/server/lib/urls";
import { procedure } from "@peated/server/orpc";
import {
  requireAuth,
  requireTosAccepted,
} from "@peated/server/orpc/middleware";
import {
  PendingUploadInputSchema,
  PendingUploadSchema,
} from "@peated/server/schemas";

export default procedure
  .use(requireAuth)
  .use(requireTosAccepted)
  .route({
    method: "POST",
    path: "/pending-uploads",
    summary: "Create pending upload",
    description:
      "Upload a temporary image for a later workflow step. Pending uploads are owned by the authenticated user and expire automatically.",
    operationId: "createPendingUpload",
  })
  .input(PendingUploadInputSchema)
  .output(PendingUploadSchema)
  .handler(async function ({ input, context, errors }) {
    const { file, purpose, idempotencyKey } = input;

    if (file.size > MAX_FILESIZE) {
      const errMessage = `File exceeded maximum upload size of ${humanizeBytes(MAX_FILESIZE)}.`;
      throw errors.PAYLOAD_TOO_LARGE({
        message: errMessage,
      });
    }

    let pendingUpload;
    pendingUpload = await createPendingImageUpload({
      file,
      purpose,
      idempotencyKey,
      createdById: context.user.id,
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    return {
      id: pendingUpload.id,
      imageUrl: absoluteUrl(config.API_SERVER, pendingUpload.imageUrl),
      kind: pendingUpload.kind,
      purpose: pendingUpload.purpose,
      status: pendingUpload.status,
      expiresAt: pendingUpload.expiresAt.toISOString(),
    };
  });
