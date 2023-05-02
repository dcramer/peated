import fs from "node:fs";
import { promisify } from "node:util";
import { pipeline } from "node:stream";
import cuid from "cuid";
import { Storage } from "@google-cloud/storage";
import { extname } from "node:path";
import type { MultipartFile } from "@fastify/multipart";

import config from "../config";

const pump = promisify(pipeline);

export const storeFile = async ({
  data,
  namespace,
  urlPrefix,
}: {
  data: MultipartFile;
  namespace: string;
  urlPrefix: string;
}): Promise<string> => {
  const newFilename = `${namespace}-${cuid()}${extname(data.filename)}`;

  if (process.env.USE_GCS_STORAGE) {
    const bucketName = process.env.GCS_BUCKET_NAME as string;
    const bucketPath = process.env.GCS_BUCKET_PATH
      ? `${process.env.GCS_BUCKET_PATH}/`
      : "";

    const cloudStorage = new Storage();
    const file = cloudStorage
      .bucket(bucketName)
      .file(`${bucketPath}${newFilename}`);
    const writeStream = file.createWriteStream();

    await pump(data.file, writeStream);

    return `${urlPrefix}/${newFilename}`;
  } else {
    const uploadPath = `${config.UPLOAD_PATH}/${newFilename}`;
    const writeStream = fs.createWriteStream(uploadPath);

    await pump(data.file, writeStream);
  }

  return "";
};
