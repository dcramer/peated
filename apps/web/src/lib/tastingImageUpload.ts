const TASTING_IMAGE_UPLOAD_TIMEOUT_MS = 90_000;

export async function uploadTastingImageAfterSave<TResult>({
  prepare,
  upload,
  timeoutMs = TASTING_IMAGE_UPLOAD_TIMEOUT_MS,
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
          () => reject(new Error(`Tasting image ${stage} timed out.`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
