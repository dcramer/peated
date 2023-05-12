import type { RouteOptions } from 'fastify'
import { open } from 'fs/promises'
import { IncomingMessage, Server, ServerResponse } from 'http'

import { contentType } from 'mime-types'
import { format } from 'path'
import config from '../config'

const MAX_AGE = 60 * 60 ** 24

export default {
  method: 'GET',
  url: '/uploads/:filename',
  schema: {
    params: {
      type: 'object',
      required: ['filename'],
      properties: {
        filename: { type: 'string' },
      },
    },
  },
  handler: async (req, res) => {
    const { filename } = req.params

    const useGcs = !!process.env.USE_GCS_STORAGE

    let stream: any
    if (useGcs) {
      const bucketName = process.env.GCS_BUCKET_NAME as string
      const bucketPath = process.env.GCS_BUCKET_PATH
        ? `${process.env.GCS_BUCKET_PATH}/`
        : ''

      // const cloudStorage = new Storage();

      // const file = cloudStorage
      //   .bucket(bucketName)
      //   .file(`${bucketPath}${params.filename}`);
      // stream = file.createReadStream();
      const url = `https://storage.googleapis.com/${bucketName}/${bucketPath}${filename}`
      res.redirect(url)
    } else {
      const filepath = format({
        dir: config.UPLOAD_PATH,
        base: filename,
      })
      const fd = await open(filepath, 'r')

      stream = fd.createReadStream()
      res.header('Cache-Control', `max-age=${MAX_AGE}, s-maxage=${MAX_AGE}`)
      res.header('Content-Type', contentType(filename))

      await res.send(stream)
    }
  },
} as RouteOptions<
  Server,
  IncomingMessage,
  ServerResponse,
  {
    Params: {
      filename: string
    }
  }
>
