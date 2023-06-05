export const toBlob = (canvas: HTMLCanvasElement) => {
  return new Promise<Blob | null>((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      resolve(blob);
    });
  });
};
