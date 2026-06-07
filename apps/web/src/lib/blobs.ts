import pica from "pica";

const IMAGE_BLOB_TYPE = "image/webp";
const IMAGE_BLOB_QUALITY = 0.9;
const MAX_IMAGE_EDGE = 1600;

export const toBlob = async (canvas: HTMLCanvasElement): Promise<Blob> => {
  const p = new pica();
  const scale = Math.min(
    MAX_IMAGE_EDGE / canvas.width,
    MAX_IMAGE_EDGE / canvas.height,
    1,
  );

  if (scale >= 1) {
    return await p.toBlob(canvas, IMAGE_BLOB_TYPE, IMAGE_BLOB_QUALITY);
  }

  const resized = document.createElement("canvas");
  resized.width = Math.max(1, Math.round(canvas.width * scale));
  resized.height = Math.max(1, Math.round(canvas.height * scale));

  await p.resize(canvas, resized);
  return await p.toBlob(resized, IMAGE_BLOB_TYPE, IMAGE_BLOB_QUALITY);
};
