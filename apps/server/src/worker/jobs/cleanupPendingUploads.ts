import { cleanupPendingUploads } from "@peated/server/lib/pendingUploads";

export default async function cleanupPendingUploadsJob() {
  await cleanupPendingUploads();
}
