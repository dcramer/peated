import { cleanupWrongPhotoMatchPhotos } from "@peated/server/lib/wrongPhotoMatches";

export default async function cleanupWrongPhotoMatchPhotosJob() {
  await cleanupWrongPhotoMatchPhotos();
}
