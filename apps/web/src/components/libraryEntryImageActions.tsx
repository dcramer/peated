"use client";

import type { CollectionBottle, PagingRel } from "@peated/server/types";
import Button from "@peated/web/components/button";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

const PENDING_UPLOAD_PURPOSE = "photo_tasting_entry";

export default function LibraryEntryImageActions({
  entry,
  username,
}: {
  entry: CollectionBottle;
  username: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const pendingUploadMutation = useMutation(
    orpc.pendingUploads.create.mutationOptions(),
  );
  const imageUpdateMutation = useMutation(
    orpc.collections.bottles.imageUpdate.mutationOptions(),
  );
  const imageDeleteMutation = useMutation(
    orpc.collections.bottles.imageDelete.mutationOptions(),
  );
  const listQueryKey = orpc.collections.bottles.list.key({
    input: {
      user: username,
      collection: "library",
    },
  });
  const isBusy =
    pendingUploadMutation.isPending ||
    imageUpdateMutation.isPending ||
    imageDeleteMutation.isPending;

  function updateCachedEntry(updatedEntry: CollectionBottle) {
    queryClient.setQueryData<{
      results: CollectionBottle[];
      rel: PagingRel;
    }>(listQueryKey, (current) => {
      if (!current) return current;

      return {
        ...current,
        results: current.results.map((item) =>
          item.id === updatedEntry.id ? updatedEntry : item,
        ),
      };
    });
  }

  async function replaceImage(file: File) {
    setError(null);
    try {
      const pendingImage = await pendingUploadMutation.mutateAsync({
        file,
        // Collection image routes currently accept reusable scan-style pending uploads.
        purpose: PENDING_UPLOAD_PURPOSE,
        idempotencyKey: `library-image-${entry.id}-${crypto.randomUUID()}`,
      });
      const updatedEntry = await imageUpdateMutation.mutateAsync({
        user: username,
        collection: "library",
        collectionBottle: entry.id,
        pendingImageId: pendingImage.id,
      });

      updateCachedEntry(updatedEntry);
      await queryClient.invalidateQueries({
        queryKey: listQueryKey,
        exact: true,
      });
    } catch (err) {
      logError(err, { context: "library_image_replace" });
      setError(
        getFormErrorMessage(err, {
          expectedErrorNames: ["BAD_REQUEST", "FORBIDDEN", "NOT_FOUND"],
        }),
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeImage() {
    setError(null);
    try {
      const updatedEntry = await imageDeleteMutation.mutateAsync({
        user: username,
        collection: "library",
        collectionBottle: entry.id,
      });

      updateCachedEntry(updatedEntry);
      await queryClient.invalidateQueries({
        queryKey: listQueryKey,
        exact: true,
      });
    } catch (err) {
      logError(err, { context: "library_image_remove" });
      setError(
        getFormErrorMessage(err, {
          expectedErrorNames: ["BAD_REQUEST", "FORBIDDEN", "NOT_FOUND"],
        }),
      );
    }
  }

  return (
    <div className="flex max-w-full flex-col gap-2 rounded border border-slate-800 bg-slate-950/40 p-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-800 bg-slate-900">
          {entry.imageUrl ? (
            <img
              src={entry.imageUrl}
              alt={`Library entry image for ${entry.bottle.fullName}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <ImagePlus className="text-muted h-6 w-6" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-white">
            Library entry image
          </div>
          <div className="text-muted text-xs">
            Only for this Library entry. It won't change public bottle or
            release images, or tasting photos.
          </div>
          {error && (
            <div className="mt-1 text-xs font-medium text-red-300" role="alert">
              {error}
            </div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button
          size="small"
          icon={<ImagePlus className="h-4 w-4" aria-hidden="true" />}
          disabled={isBusy}
          loading={
            pendingUploadMutation.isPending || imageUpdateMutation.isPending
          }
          onClick={() => fileInputRef.current?.click()}
        >
          Replace
        </Button>
        <Button
          size="small"
          color="danger"
          icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
          disabled={isBusy || !entry.imageUrl}
          loading={imageDeleteMutation.isPending}
          onClick={() => void removeImage()}
        >
          Remove
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label={`Replace Library entry image for ${entry.bottle.fullName}`}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) void replaceImage(file);
          }}
        />
      </div>
    </div>
  );
}
