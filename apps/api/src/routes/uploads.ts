import { Storage } from "@google-cloud/storage";
import type { RouteOptions } from "fastify";
import { open } from "fs/promises";
import type { IncomingMessage, Server, ServerResponse } from "http";
import { contentType } from "mime-types";
import { format } from "path";
import { type Readable } from "stream";
import config from "../config";

const MAX_AGE = 60 * 60 * 24;

export default {
  method: "GET",
  url: "/uploads/:filename",
  schema: {
    params: {
      type: "object",
      required: ["filename"],
      properties: {
        filename: { type: "string" },
      },
    },
  },
  handler: async (req, res) => {
    const { filename } = req.params;

    let stream: Readable;
    if (process.env.USE_GCS_STORAGE) {
      const bucketName = process.env.GCS_BUCKET_NAME as string;
      const bucketPath = process.env.GCS_BUCKET_PATH
        ? `${process.env.GCS_BUCKET_PATH}/`
        : "";

      const cloudStorage = new Storage({
        credentials: config.GCP_CREDENTIALS,
      });
      const fd = cloudStorage
        .bucket(bucketName)
        .file(`${bucketPath}${filename}`);

      stream = fd.createReadStream();
      // const url = `https://storage.googleapis.com/${bucketName}/${bucketPath}${filename}`;
      // res.redirect(url);
    } else {
      const filepath = format({
        dir: config.UPLOAD_PATH,
        base: filename,
      });
      const fd = await open(filepath, "r");

      stream = fd.createReadStream();
    }
    await res
      .header("Cache-Control", `public, max-age=${MAX_AGE}`)
      .header("Content-Type", contentType(filename))
      .send(stream);
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      filename: string;
    };
  }
>;
