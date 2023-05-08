import { createWriteStream } from "node:fs";
import { promisify } from "node:util";
import { pipeline } from "node:stream";
import { Storage } from "@google-cloud/storage";
import { extname } from "node:path";
import type { MultipartFile } from "@fastify/multipart";
import { createId } from "@paralleldrive/cuid2";

import config from "../config";
import { trace } from "@sentry/node";

const pump = promisify(pipeline);

export const storeFile = async ({
  data,
  namespace,
  urlPrefix,
}: {
  data: MultipartFile;
  namespace: string;
  urlPrefix: string;
}) => {
  const newFilename = `${namespace}-${createId()}${extname(data.filename)}`;

  if (process.env.USE_GCS_STORAGE) {
    const bucketName = config.GCS_BUCKET_NAME as string;
    const bucketPath = config.GCS_BUCKET_PATH
      ? `${config.GCS_BUCKET_PATH}/`
      : "";

    const cloudStorage = new Storage({
      credentials: config.GCP_CREDENTIALS,
    });

    await trace(
      {
        op: "gcs.file",
        name: "gcs.file",
        data: { bucketName, fileName: newFilename },
      },
      async () => {
        const file = cloudStorage
          .bucket(bucketName)
          .file(`${bucketPath}${newFilename}`);

        await trace(
          { op: "gcs.file.write-stream", name: "gcs.file.write-stream" },
          async () => {
            const writeStream = file.createWriteStream();
            // data.file.pipe(writeStream);
            await pump(data.file, writeStream);
          }
        );
      }
    );
  } else {
    const uploadPath = `${config.UPLOAD_PATH}/${newFilename}`;

    trace(
      {
        op: "file.write-stream",
        name: "file.write-stream",
        data: { fileName: newFilename },
      },
      () => {
        const writeStream = createWriteStream(uploadPath);
        data.file.pipe(writeStream);
        // await pump(data.file, writeStream);
      }
    );

    console.info(`File written to ${uploadPath}`);
  }

  return `${urlPrefix}/${newFilename}`;
};
