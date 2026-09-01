export type ImageUploadValue = HTMLCanvasElement | File | null | undefined;

const IMAGE_UPLOAD_TIMEOUT_MS = 90_000;

export async function uploadImageAfterSave<TResult>({
  prepare,
  upload,
  timeoutMs = IMAGE_UPLOAD_TIMEOUT_MS,
}: {
  prepare: () => Promise<Blob>;
  upload: (file: Blob) => Promise<TResult>;
  timeoutMs?: number;
}): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let stage: "preparation" | "upload" = "preparation";

  try {
    await Promise.race([
      (async () => {
        const file = await prepare();
        stage = "upload";
        await upload(file);
      })(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`Image ${stage} timed out.`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
