import pica from "pica";

export const toBlob = (
  canvas: HTMLCanvasElement,
  quality = 1,
  type = "image/webp",
) => {
  const p = new pica();
  return new Promise<Blob | null>((resolve, reject) => {
    // const offScreenCanvas = document.createElement("canvas");
    // offScreenCanvas.width = canvas.width;
    // offScreenCanvas.height = canvas.height;

    p.toBlob(canvas, type, quality).then((blob) => resolve(blob));
  });
};
