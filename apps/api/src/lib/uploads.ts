import { createWriteStream } from "node:fs";
import { promisify } from "node:util";
import { pipeline } from "node:stream";
import { Storage } from "@google-cloud/storage";
import { extname } from "node:path";
import type { MultipartFile } from "@fastify/multipart";
import opentelemetry from "@opentelemetry/api";
import { createId } from "@paralleldrive/cuid2";

import config from "../config";

const pump = promisify(pipeline);

const tracer = opentelemetry.trace.getTracer("peated-api");

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

    await tracer.startActiveSpan("gcs.file", async () => {
      const file = cloudStorage
        .bucket(bucketName)
        .file(`${bucketPath}${newFilename}`);

      await tracer.startActiveSpan("gcs.file.write-stream", async () => {
        const writeStream = file.createWriteStream();
        data.file.pipe(writeStream);
        // await pump(data.file, writeStream);
      });
    });
  } else {
    const uploadPath = `${config.UPLOAD_PATH}/${newFilename}`;

    tracer.startActiveSpan("file.write-stream", () => {
      const writeStream = createWriteStream(uploadPath);
      data.file.pipe(writeStream);
      // await pump(data.file, writeStream);
    });

    console.info(`File written to ${uploadPath}`);
  }

  return `${urlPrefix}/${newFilename}`;
};
