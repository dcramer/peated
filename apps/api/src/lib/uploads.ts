import type { MultipartFile } from "@fastify/multipart";
import { Storage } from "@google-cloud/storage";
import { createId } from "@paralleldrive/cuid2";
import { createWriteStream } from "node:fs";
import { extname } from "node:path";
import sharp from "sharp";

import { trace } from "@sentry/node";
import { Readable } from "node:stream";
import { promisify } from "node:util";
import { pipeline } from "stream";
import config from "../config";

const pump = promisify(pipeline);

export const compressAndResizeImage = (
  stream: Readable,
  filename: string,
  maxWidth?: number,
  maxHeight?: number,
) => {
  const transformer = sharp()
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: sharp.fit.cover,
      position: sharp.strategy.entropy,
    })
    .webp({ quality: 80 });

  return {
    stream: stream.pipe(transformer),
    filename: `${filename.substring(0, filename.lastIndexOf("."))}.webp`,
  };
};

type ProcessCallback = (
  stream: Readable,
  filename: string,
) => { stream: Readable; filename: string };

export const storeFile = async ({
  data,
  namespace,
  urlPrefix,
  onProcess,
}: {
  data: MultipartFile;
  namespace: string;
  urlPrefix: string;
  onProcess?: ProcessCallback;
}) => {
  const tmpFilename = `${namespace}-${createId()}${extname(data.filename)}`;
  const { stream, filename: newFilename } = onProcess
    ? onProcess(data.file, tmpFilename)
    : { stream: data.file, filename: tmpFilename };

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
        description: newFilename,
        data: { bucketName },
      },
      async () => {
        const file = cloudStorage
          .bucket(bucketName)
          .file(`${bucketPath}${newFilename}`);

        await trace(
          {
            op: "gcs.file.write-stream",
            name: "gcs.file.write-stream",
            description: newFilename,
          },
          async () => {
            const writeStream = file.createWriteStream();
            await pump(stream, writeStream);
          },
        );
      },
    );
  } else {
    const uploadPath = `${config.UPLOAD_PATH}/${newFilename}`;

    await trace(
      {
        op: "file.write-stream",
        name: "file.write-stream",
        description: newFilename,
      },
      async () => {
        const writeStream = createWriteStream(uploadPath);
        await pump(stream, writeStream);
      },
    );

    console.info(`File written to ${uploadPath}`);
  }

  return `${urlPrefix}/${newFilename}`;
};
