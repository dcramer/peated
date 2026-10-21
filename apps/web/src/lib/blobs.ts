import pica from "pica";

const IMAGE_BLOB_TYPE = "image/webp";
const IMAGE_BLOB_QUALITY = 0.9;
const MAX_IMAGE_EDGE = 1600;
const UPLOAD_PHOTO_TYPE = "image/jpeg";
const UPLOAD_PHOTO_QUALITY = 0.9;

type ImageProcessor = {
  resize(
    source: HTMLCanvasElement,
    destination: HTMLCanvasElement,
  ): Promise<HTMLCanvasElement>;
  toBlob(
    canvas: HTMLCanvasElement,
    type: string,
    quality: number,
  ): Promise<Blob>;
};

export type CreateImageProcessor = () => ImageProcessor;

const createImageProcessor: CreateImageProcessor = () =>
  new pica({ features: ["js", "wasm"] });

export const toBlob = async (
  canvas: HTMLCanvasElement,
  createProcessor: CreateImageProcessor = createImageProcessor,
): Promise<Blob> => {
  // Pica's generated worker can throw before posting a response on Mobile
  // Safari, leaving its resize promise pending indefinitely.
  const processor = createProcessor();
  const scale = Math.min(
    MAX_IMAGE_EDGE / canvas.width,
    MAX_IMAGE_EDGE / canvas.height,
    1,
  );

  if (scale >= 1) {
    return await processor.toBlob(canvas, IMAGE_BLOB_TYPE, IMAGE_BLOB_QUALITY);
  }

  const resized = document.createElement("canvas");
  resized.width = Math.max(1, Math.round(canvas.width * scale));
  resized.height = Math.max(1, Math.round(canvas.height * scale));

  await processor.resize(canvas, resized);
  return await processor.toBlob(resized, IMAGE_BLOB_TYPE, IMAGE_BLOB_QUALITY);
};

async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Unable to read the image."));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Shrinks a photo to fit within 1600 × 1600 before upload, so a full-size phone
 * photo uploads quickly on a slow connection. The server keeps the same bounds,
 * so the label reader loses nothing. Best-effort: a photo the browser cannot
 * draw uploads unchanged, and the server decides whether it is usable.
 */
export async function shrinkPhotoForUpload(file: File): Promise<File> {
  const image = await loadImage(file).catch(() => null);
  if (!image) return file;

  const scale = Math.min(
    MAX_IMAGE_EDGE / image.naturalWidth,
    MAX_IMAGE_EDGE / image.naturalHeight,
    1,
  );
  if (scale >= 1) return file;

  // Draw straight into the smaller canvas: Mobile Safari cannot hold a
  // full-size 24 MP photo in one canvas.
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  // JPEG because Safari cannot encode WebP from a canvas.
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, UPLOAD_PHOTO_TYPE, UPLOAD_PHOTO_QUALITY),
  );
  if (!blob) return file;

  const name = file.name.replace(/\.[^.]*$/, "") || "photo";
  return new File([blob], `${name}.jpg`, { type: UPLOAD_PHOTO_TYPE });
}
