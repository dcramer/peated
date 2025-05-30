import { Storage } from "@google-cloud/storage";
import { createId } from "@paralleldrive/cuid2";
import { createWriteStream } from "node:fs";
import sharp from "sharp";

import { startSpan } from "@sentry/node";
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
      withoutEnlargement: true,
    })
    .trim()
    .unflatten()
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

// New MultipartFile type to replace the Fastify one
interface MultipartFile {
  file: Readable;
  filename: string;
  fieldname: string;
  encoding?: string;
  mimetype?: string;
  fields?: Record<string, string | string[]>;
  toBuffer(): Promise<Buffer>;
}

export async function copyFile({
  input,
  output,
  namespace,
  urlPrefix,
}: {
  input: string;
  output: string;
  namespace: string;
  urlPrefix: string;
}) {
  return await startSpan(
    {
      op: "peated.copy-file",
      name: input,
    },
    async (span) => {
      span?.setAttributes({
        input,
        output,
        namespace,
      });

      if (process.env.USE_GCS_STORAGE) {
        const bucketName = config.GCS_BUCKET_NAME as string;
        const bucketPath = config.GCS_BUCKET_PATH
          ? `${config.GCS_BUCKET_PATH}/`
          : "";

        span?.setAttributes({
          bucketName,
        });

        const cloudStorage = new Storage({
          credentials: config.GCP_CREDENTIALS,
        });

        const dest = cloudStorage
          .bucket(bucketName)
          .file(`${bucketPath}${output}`);

        cloudStorage
          .bucket(bucketName)
          .file(`${bucketPath}${input}`)
          .copy(dest);
      } else {
        throw new Error();
        // const uploadPath = `${config.UPLOAD_PATH}/${input}`;

        // await startSpan(
        //   {
        //     op: "file.write-stream",
        //     name: newFilename,
        //   },
        //   async () => {
        //     const writeStream = createWriteStream(uploadPath);
        //     await pipeline(stream, writeStream);
        //   },
        // );

        // console.info(`File written to ${uploadPath}`);
      }

      return `${urlPrefix}/${output}`;
    },
  );
}

export const storeFile = async ({
  data,
  namespace,
  urlPrefix,
  onProcess,
}: {
  data:
    | MultipartFile
    | {
        filename?: string;
        file: Readable;
      };
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
      name: data.filename || "file",
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
