export const toBlob = (
  canvas: HTMLCanvasElement,
  quality = 1,
  type = "image/webp",
) => {
  return new Promise<Blob | null>((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        resolve(blob);
      },
      type,
      quality,
    );
  });
};
