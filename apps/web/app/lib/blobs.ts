export const toBlob = (canvas: HTMLCanvasElement) => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      resolve(blob);
    });
  });
};
