import { createWriteStream } from "node:fs";
import { promisify } from "node:util";
import { pipeline } from "node:stream";
import { Storage } from "@google-cloud/storage";
import { extname } from "node:path";
import type { MultipartFile } from "@fastify/multipart";

import config from "../config";
import { createId } from "@paralleldrive/cuid2";

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
    const file = cloudStorage
      .bucket(bucketName)
      .file(`${bucketPath}${newFilename}`);
    const writeStream = file.createWriteStream();

    await pump(data.file, writeStream);
  } else {
    const uploadPath = `${config.UPLOAD_PATH}/${newFilename}`;
    const writeStream = createWriteStream(uploadPath);

    data.file.pipe(writeStream);
    // await pump(data.file, writeStream);

    console.info(`File written to ${uploadPath}`);
  }

  return `${urlPrefix}/${newFilename}`;
};
