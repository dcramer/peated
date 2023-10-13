import type { MultipartFile } from "@fastify/multipart";
import { Storage } from "@google-cloud/storage";
import { createId } from "@paralleldrive/cuid2";
import { createWriteStream } from "node:fs";
import sharp from "sharp";

import { startSpan } from "@sentry/node-experimental";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import config from "../config";

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
    filename: `${
      filename.substring(0, filename.lastIndexOf(".")) || filename
    }.webp`,
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
  const tmpFilename = `${namespace}-${createId()}`;
  const { stream, filename: newFilename } = onProcess
    ? onProcess(data.file, tmpFilename)
    : { stream: data.file, filename: tmpFilename };

  return await startSpan(
    {
      op: "peated.store-file",
      name: data.filename,
    },
    async (span) => {
      span?.setAttributes({
        filename: data.filename,
        namespace,
        onProcess: Boolean(onProcess),
      });

      if (process.env.USE_GCS_STORAGE) {
        const bucketName = config.GCS_BUCKET_NAME as string;
        const bucketPath = config.GCS_BUCKET_PATH
          ? `${config.GCS_BUCKET_PATH}/`
          : "";

        const cloudStorage = new Storage({
          credentials: config.GCP_CREDENTIALS,
        });

        await startSpan(
          {
            op: "gcs.file",
            name: newFilename,
          },
          async (span) => {
            span?.setAttributes({
              bucketName,
            });
            const file = cloudStorage
              .bucket(bucketName)
              .file(`${bucketPath}${newFilename}`);

            await startSpan(
              {
                op: "gcs.file.write-stream",
                name: newFilename,
              },
              async () => {
                const writeStream = file.createWriteStream();
                await pipeline(stream, writeStream);
              },
            );
          },
        );
      } else {
        const uploadPath = `${config.UPLOAD_PATH}/${newFilename}`;

        await startSpan(
          {
            op: "file.write-stream",
            name: newFilename,
          },
          async () => {
            const writeStream = createWriteStream(uploadPath);
            await pipeline(stream, writeStream);
          },
        );

        console.info(`File written to ${uploadPath}`);
      }

      return `${urlPrefix}/${newFilename}`;
    },
  );
};
