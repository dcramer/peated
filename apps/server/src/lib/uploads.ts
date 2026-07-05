import { createId } from "@paralleldrive/cuid2";
import { createWriteStream } from "node:fs";
import {
  copyFile as copyLocalFile,
  mkdir,
  readFile as readLocalFile,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { startSpan } from "@sentry/node";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import config from "../config";
import { getStorage } from "./gcs";
import { logInfo } from "./log";

/**
 * Normalizes EXIF orientation, resizes the image, and emits a WebP stream.
 */
export const compressAndResizeImage = (
  stream: Readable,
  filename: string,
  maxWidth?: number,
  maxHeight?: number,
) => {
  const transformer = sharp()
    .rotate()
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
  urlPrefix,
}: {
  input: string;
  output: string;
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
      });

      if (process.env.USE_GCS_STORAGE) {
        const bucketName = config.GCS_BUCKET_NAME as string;
        const bucketPath = config.GCS_BUCKET_PATH
          ? `${config.GCS_BUCKET_PATH}/`
          : "";

        span?.setAttributes({
          bucketName,
        });

        const cloudStorage = getStorage();
        const dest = cloudStorage
          .bucket(bucketName)
          .file(`${bucketPath}${output}`);

        await cloudStorage
          .bucket(bucketName)
          .file(`${bucketPath}${input}`)
          .copy(dest);
      } else {
        const inputPath = path.join(config.UPLOAD_PATH, input);
        const outputPath = path.join(config.UPLOAD_PATH, output);
        await mkdir(path.dirname(outputPath), { recursive: true });
        await copyLocalFile(inputPath, outputPath);
      }

      return `${urlPrefix}/${output}`;
    },
  );
}

export async function deleteFile({
  filename,
}: {
  filename: string;
}): Promise<void> {
  await startSpan(
    {
      op: "peated.delete-file",
      name: filename,
    },
    async (span) => {
      span?.setAttributes({
        filename,
      });

      if (process.env.USE_GCS_STORAGE) {
        const bucketName = config.GCS_BUCKET_NAME as string;
        const bucketPath = config.GCS_BUCKET_PATH
          ? `${config.GCS_BUCKET_PATH}/`
          : "";

        await getStorage()
          .bucket(bucketName)
          .file(`${bucketPath}${filename}`)
          .delete({ ignoreNotFound: true });
      } else {
        try {
          await unlink(path.join(config.UPLOAD_PATH, filename));
        } catch (err: any) {
          if (err?.code !== "ENOENT") {
            throw err;
          }
        }
      }
    },
  );
}

export async function readFile({
  filename,
}: {
  filename: string;
}): Promise<Buffer> {
  return await startSpan(
    {
      op: "peated.read-file",
      name: filename,
    },
    async (span) => {
      span?.setAttributes({
        filename,
      });

      if (process.env.USE_GCS_STORAGE) {
        const bucketName = config.GCS_BUCKET_NAME as string;
        const bucketPath = config.GCS_BUCKET_PATH
          ? `${config.GCS_BUCKET_PATH}/`
          : "";

        const [contents] = await getStorage()
          .bucket(bucketName)
          .file(`${bucketPath}${filename}`)
          .download();
        return contents;
      }

      return await readLocalFile(path.join(config.UPLOAD_PATH, filename));
    },
  );
}

export const storeFile = async ({
  data,
  namespace,
  urlPrefix,
  onProcess,
  directory,
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
  directory?: string;
}) => {
  const tmpFilename = `${namespace}-${createId()}`;
  const { stream, filename: newFilename } = onProcess
    ? onProcess(data.file, tmpFilename)
    : { stream: data.file, filename: tmpFilename };
  const outputFilename = directory
    ? `${directory}/${newFilename}`
    : newFilename;

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
        directory,
      });

      if (process.env.USE_GCS_STORAGE) {
        const bucketName = config.GCS_BUCKET_NAME as string;
        const bucketPath = config.GCS_BUCKET_PATH
          ? `${config.GCS_BUCKET_PATH}/`
          : "";

        await startSpan(
          {
            op: "gcs.file",
            name: newFilename,
          },
          async (span) => {
            span?.setAttributes({
              bucketName,
            });
            const file = getStorage()
              .bucket(bucketName)
              .file(`${bucketPath}${outputFilename}`);

            await startSpan(
              {
                op: "gcs.file.write-stream",
                name: outputFilename,
              },
              async () => {
                // Current callers pass processed image streams; avoid GCS
                // resumable-session startup for these small writes.
                const writeStream = file.createWriteStream({
                  resumable: false,
                });
                await pipeline(stream, writeStream);
              },
            );
          },
        );
      } else {
        const uploadPath = `${config.UPLOAD_PATH}/${outputFilename}`;

        await startSpan(
          {
            op: "file.write-stream",
            name: outputFilename,
          },
          async () => {
            await mkdir(path.dirname(uploadPath), { recursive: true });
            const writeStream = createWriteStream(uploadPath);
            await pipeline(stream, writeStream);
          },
        );

        logInfo("File written to {uploadPath}", {
          extra: {
            uploadPath,
          },
        });
      }

      return `${urlPrefix}/${outputFilename}`;
    },
  );
};
