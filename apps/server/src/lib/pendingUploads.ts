import { createId } from "@paralleldrive/cuid2";
import { db } from "@peated/server/db";
import {
  type NewPendingUpload,
  type PendingUpload,
  pendingUploads,
} from "@peated/server/db/schema";
import { logError } from "@peated/server/lib/log";
import { copyFile, deleteFile, storeFile } from "@peated/server/lib/uploads";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import path from "node:path";
import { Readable } from "node:stream";

export const PENDING_UPLOAD_NAMESPACE = "pending-uploads";
export const PERMANENT_UPLOAD_NAMESPACES = [
  "tastings",
  "bottles",
  "bottle-releases",
  "badges",
  "avatars",
] as const;
export const DEFAULT_PENDING_UPLOAD_TTL_MS = 1000 * 60 * 60 * 48;

export class PendingUploadError extends Error {}
export class PendingUploadNotFoundError extends PendingUploadError {}
export class PendingUploadExpiredError extends PendingUploadError {}

type ProcessCallback = (
  stream: Readable,
  filename: string,
) => { stream: Readable; filename: string };

function filenameFromUploadUrl(imageUrl: string): string {
  if (!imageUrl.startsWith("/uploads/")) {
    throw new PendingUploadError("Pending upload URL is not an upload URL.");
  }
  return imageUrl.slice("/uploads/".length);
}

function isPermanentUploadNamespace(
  namespace: string,
): namespace is (typeof PERMANENT_UPLOAD_NAMESPACES)[number] {
  return (PERMANENT_UPLOAD_NAMESPACES as readonly string[]).includes(namespace);
}

function isPendingUploadIdempotencyConflict(err: any) {
  return (
    err?.code === "23505" &&
    err?.constraint === "pending_upload_idempotency_key"
  );
}

async function findPendingUploadByIdempotencyKey({
  createdById,
  purpose,
  idempotencyKey,
}: {
  createdById: number;
  purpose: NewPendingUpload["purpose"];
  idempotencyKey: string;
}) {
  return await db.query.pendingUploads.findFirst({
    where: and(
      eq(pendingUploads.createdById, createdById),
      eq(pendingUploads.purpose, purpose),
      eq(pendingUploads.idempotencyKey, idempotencyKey),
    ),
  });
}

export async function createPendingImageUpload({
  file,
  createdById,
  purpose,
  idempotencyKey,
  ttlMs = DEFAULT_PENDING_UPLOAD_TTL_MS,
  onProcess,
}: {
  file: Blob;
  createdById: number;
  purpose: NewPendingUpload["purpose"];
  idempotencyKey?: string | null;
  ttlMs?: number;
  onProcess?: ProcessCallback;
}): Promise<PendingUpload> {
  if (idempotencyKey) {
    const existing = await findPendingUploadByIdempotencyKey({
      createdById,
      purpose,
      idempotencyKey,
    });
    if (existing) {
      return existing;
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const imageUrl = await storeFile({
    data: {
      file: Readable.from(buffer),
    },
    namespace: "pending-upload",
    directory: PENDING_UPLOAD_NAMESPACE,
    urlPrefix: "/uploads",
    onProcess,
  });

  const deleteStoredUpload = async () => {
    try {
      await deleteFile({ filename: filenameFromUploadUrl(imageUrl) });
    } catch (cleanupErr) {
      logError(cleanupErr, {
        source: "pending_upload_cleanup_after_create_failure",
        imageUrl,
      });
    }
  };

  let pendingUpload: PendingUpload | undefined;
  try {
    [pendingUpload] = await db
      .insert(pendingUploads)
      .values({
        id: createId(),
        createdById,
        imageUrl,
        namespace: PENDING_UPLOAD_NAMESPACE,
        kind: "image",
        purpose,
        status: "pending",
        idempotencyKey: idempotencyKey || null,
        expiresAt: new Date(Date.now() + ttlMs),
      })
      .returning();
  } catch (err) {
    await deleteStoredUpload();

    if (idempotencyKey && isPendingUploadIdempotencyConflict(err)) {
      const existing = await findPendingUploadByIdempotencyKey({
        createdById,
        purpose,
        idempotencyKey,
      });
      if (existing) {
        return existing;
      }
    }
    throw err;
  }

  if (!pendingUpload) {
    throw new PendingUploadError("Unable to create pending upload.");
  }

  return pendingUpload;
}

async function getUsablePendingUpload({
  id,
  userId,
  now = new Date(),
}: {
  id: string;
  userId: number;
  now?: Date;
}): Promise<PendingUpload> {
  const pendingUpload = await db.query.pendingUploads.findFirst({
    where: and(
      eq(pendingUploads.id, id),
      eq(pendingUploads.createdById, userId),
    ),
  });

  if (!pendingUpload) {
    throw new PendingUploadNotFoundError("Pending upload not found.");
  }

  if (pendingUpload.status !== "pending" || pendingUpload.expiresAt <= now) {
    throw new PendingUploadExpiredError("Pending upload has expired.");
  }

  return pendingUpload;
}

export async function copyPendingUploadToPermanent({
  id,
  userId,
  destinationNamespace,
  attachedToType,
  attachedToId,
}: {
  id: string;
  userId: number;
  destinationNamespace: (typeof PERMANENT_UPLOAD_NAMESPACES)[number];
  attachedToType: string;
  attachedToId: number;
}): Promise<string> {
  if (!isPermanentUploadNamespace(destinationNamespace)) {
    throw new PendingUploadError("Invalid permanent upload namespace.");
  }

  const pendingUpload = await getUsablePendingUpload({ id, userId });
  const input = filenameFromUploadUrl(pendingUpload.imageUrl);
  const output = `${destinationNamespace}/${path.posix.basename(input)}`;

  const imageUrl = await copyFile({
    input,
    output,
    urlPrefix: "/uploads",
  });

  await db
    .update(pendingUploads)
    .set({
      status: "attached",
      attachedToType,
      attachedToId,
    })
    .where(eq(pendingUploads.id, pendingUpload.id));

  return imageUrl;
}

export async function cleanupPendingUploads({
  now = new Date(),
  limit = 100,
}: {
  now?: Date;
  limit?: number;
} = {}): Promise<{ expired: number; deletedAttached: number }> {
  const candidates = await db.query.pendingUploads.findMany({
    where: or(
      and(
        eq(pendingUploads.status, "pending"),
        lte(pendingUploads.expiresAt, now),
      ),
      and(
        eq(pendingUploads.status, "attached"),
        isNull(pendingUploads.objectDeletedAt),
      ),
    ),
    limit,
  });

  let expired = 0;
  let deletedAttached = 0;

  for (const pendingUpload of candidates) {
    let filename: string | null = null;

    try {
      filename = filenameFromUploadUrl(pendingUpload.imageUrl);
      await deleteFile({ filename });

      if (pendingUpload.status === "pending") {
        await db
          .update(pendingUploads)
          .set({ status: "expired" })
          .where(eq(pendingUploads.id, pendingUpload.id));
        expired += 1;
      } else {
        await db
          .update(pendingUploads)
          .set({ objectDeletedAt: now })
          .where(eq(pendingUploads.id, pendingUpload.id));
        deletedAttached += 1;
      }
    } catch (err) {
      logError(err, {
        pendingUpload: {
          id: pendingUpload.id,
          status: pendingUpload.status,
          imageUrl: pendingUpload.imageUrl,
          filename,
        },
      });
    }
  }

  return { expired, deletedAttached };
}
