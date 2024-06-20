import pica from "pica";

export const toBlob = async (
  canvas: HTMLCanvasElement,
  quality = 1,
  type = "image/webp",
): Promise<Blob> => {
  const p = new pica();
  return await p.toBlob(canvas, type, quality);
};
