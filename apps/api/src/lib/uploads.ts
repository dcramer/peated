import type { MultipartFile } from '@fastify/multipart'
import { Storage } from '@google-cloud/storage'
import { createId } from '@paralleldrive/cuid2'
import { createWriteStream } from 'node:fs'
import { extname } from 'node:path'
import { pipeline } from 'node:stream'
import { promisify } from 'node:util'

import { trace } from '@sentry/node'
import config from '../config'

const pump = promisify(pipeline)

export const storeFile = async ({
  data,
  namespace,
  urlPrefix,
}: {
  data: MultipartFile
  namespace: string
  urlPrefix: string
}) => {
  const newFilename = `${namespace}-${createId()}${extname(data.filename)}`

  if (process.env.USE_GCS_STORAGE) {
    const bucketName = config.GCS_BUCKET_NAME as string
    const bucketPath = config.GCS_BUCKET_PATH
      ? `${config.GCS_BUCKET_PATH}/`
      : ''

    const cloudStorage = new Storage({
      credentials: config.GCP_CREDENTIALS,
    })

    await trace(
      {
        op: 'gcs.file',
        name: 'gcs.file',
        description: newFilename,
        data: { bucketName },
      },
      async () => {
        const file = cloudStorage
          .bucket(bucketName)
          .file(`${bucketPath}${newFilename}`)

        await trace(
          {
            op: 'gcs.file.write-stream',
            name: 'gcs.file.write-stream',
            description: newFilename,
          },
          async () => {
            const writeStream = file.createWriteStream()
            // data.file.pipe(writeStream);
            await pump(data.file, writeStream)
          },
        )
      },
    )
  } else {
    const uploadPath = `${config.UPLOAD_PATH}/${newFilename}`

    trace(
      {
        op: 'file.write-stream',
        name: 'file.write-stream',
        description: newFilename,
      },
      () => {
        const writeStream = createWriteStream(uploadPath)
        data.file.pipe(writeStream)
        // await pump(data.file, writeStream);
      },
    )

    console.info(`File written to ${uploadPath}`)
  }

  return `${urlPrefix}/${newFilename}`
}
