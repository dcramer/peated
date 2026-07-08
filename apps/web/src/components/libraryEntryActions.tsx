"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import {
  CheckIcon,
  ChevronDownIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/20/solid";
import type { CollectionBottle, PagingRel } from "@peated/server/types";
import Button from "@peated/web/components/button";
import { ImageModal } from "@peated/web/components/imageModal";
import {
  COLLECTION_BOTTLE_STATUS_META,
  COLLECTION_BOTTLE_STATUS_VALUES,
  CollectionBottleStatusLabel,
  type CollectionBottleStatus,
} from "@peated/web/components/libraryBottleStatus";
import classNames from "@peated/web/lib/classNames";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus } from "lucide-react";
import { useRef, useState } from "react";

const PENDING_UPLOAD_PURPOSE = "photo_tasting_entry";

function useLibraryEntryMutations({
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
  const entryDeleteMutation = useMutation(
    orpc.collections.bottles.delete.mutationOptions(),
  );
  const statusUpdateMutation = useMutation(
    orpc.collections.bottles.update.mutationOptions(),
  );
  const listQueryKey = orpc.collections.bottles.list.key({
    input: {
      user: username,
      collection: "library",
    },
  });
  const collectionStatusQueryKey = orpc.collections.bottles.list.key({
    input: {
      user: "me",
      collection: "library",
      bottle: entry.bottle.id,
      release: entry.release?.id ?? undefined,
      baseOnly: entry.release == null,
    },
  });
  const isBusy =
    pendingUploadMutation.isPending ||
    imageUpdateMutation.isPending ||
    entryDeleteMutation.isPending ||
    statusUpdateMutation.isPending;

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
    queryClient.setQueriesData<{
      results: CollectionBottle[];
      rel: PagingRel;
    }>(
      {
        predicate: (query) => {
          const queryKey = JSON.stringify(query.queryKey);
          return (
            queryKey.includes("collections") &&
            queryKey.includes("bottles") &&
            queryKey.includes("list") &&
            queryKey.includes("library") &&
            queryKey.includes(username)
          );
        },
      },
      (current) => {
        if (!current) return current;

        return {
          ...current,
          results: current.results.map((item) =>
            item.id === updatedEntry.id ? updatedEntry : item,
          ),
        };
      },
    );
  }

  function removeCachedEntry() {
    queryClient.setQueryData<{
      results: CollectionBottle[];
      rel: PagingRel;
    }>(listQueryKey, (current) => {
      if (!current) return current;

      return {
        ...current,
        results: current.results.filter((item) => item.id !== entry.id),
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
      await queryClient.invalidateQueries({
        queryKey: collectionStatusQueryKey,
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

  async function updateStatus(status: CollectionBottle["status"]) {
    setError(null);
    try {
      const updatedEntry = await statusUpdateMutation.mutateAsync({
        user: username,
        collection: "library",
        collectionBottle: entry.id,
        status,
      });

      updateCachedEntry(updatedEntry);
      await queryClient.invalidateQueries({
        queryKey: listQueryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: collectionStatusQueryKey,
      });
    } catch (err) {
      logError(err, { context: "library_entry_status_update" });
      setError(
        getFormErrorMessage(err, {
          expectedErrorNames: ["BAD_REQUEST", "FORBIDDEN", "NOT_FOUND"],
        }),
      );
    }
  }

  async function removeFromLibrary() {
    setError(null);
    try {
      await entryDeleteMutation.mutateAsync({
        bottle: entry.bottle.id,
        release: entry.release?.id ?? null,
        baseOnly: entry.release == null,
        user: "me",
        collection: "library",
      });

      removeCachedEntry();
      await queryClient.invalidateQueries({
        queryKey: listQueryKey,
        exact: true,
      });
      await queryClient.invalidateQueries({
        queryKey: collectionStatusQueryKey,
      });
    } catch (err) {
      logError(err, { context: "library_entry_remove" });
      setError(
        getFormErrorMessage(err, {
          expectedErrorNames: ["BAD_REQUEST", "FORBIDDEN", "NOT_FOUND"],
        }),
      );
    }
  }

  return {
    error,
    fileInputRef,
    isBusy,
    removeFromLibrary,
    replaceImage,
    updateStatus,
  };
}

export function LibraryEntryThumbnail({ entry }: { entry: CollectionBottle }) {
  const [imageOpen, setImageOpen] = useState(false);

  return entry.imageUrl ? (
    <div className="h-12 w-12 shrink-0">
      <button
        type="button"
        className="h-12 w-12 overflow-hidden rounded border border-slate-800 bg-slate-900"
        aria-label={`View image for ${entry.bottle.fullName}`}
        onClick={() => setImageOpen(true)}
      >
        <img
          src={entry.imageUrl}
          alt={`Photo of ${entry.bottle.fullName}`}
          className="h-full w-full object-cover"
        />
      </button>
      <ImageModal
        image={entry.imageUrl}
        alt={`Photo of ${entry.bottle.fullName}`}
        title={`Photo of ${entry.bottle.fullName}`}
        open={imageOpen}
        setOpen={setImageOpen}
      />
    </div>
  ) : null;
}

export function LibraryEntryImage({
  entry,
  username,
}: {
  entry: CollectionBottle;
  username: string;
}) {
  const { error, fileInputRef, isBusy, replaceImage } =
    useLibraryEntryMutations({
      entry,
      username,
    });
  const [imageOpen, setImageOpen] = useState(false);
  const imageAlt = `Photo of ${entry.bottle.fullName}`;

  return (
    <div className="min-w-0 shrink-0">
      <button
        type="button"
        className="flex h-12 w-12 items-center justify-center overflow-hidden rounded border border-slate-800 bg-slate-900 disabled:opacity-60"
        aria-label={
          entry.imageUrl
            ? `View image for ${entry.bottle.fullName}`
            : `Add image for ${entry.bottle.fullName}`
        }
        disabled={isBusy}
        onClick={() => {
          if (entry.imageUrl) {
            setImageOpen(true);
          } else {
            fileInputRef.current?.click();
          }
        }}
      >
        {entry.imageUrl ? (
          <img
            src={entry.imageUrl}
            alt={imageAlt}
            className="h-full w-full object-cover"
          />
        ) : (
          <ImagePlus className="text-muted h-6 w-6" aria-hidden="true" />
        )}
      </button>
      {entry.imageUrl && (
        <ImageModal
          image={entry.imageUrl}
          alt={imageAlt}
          title={imageAlt}
          open={imageOpen}
          setOpen={setImageOpen}
          action={{
            label: "Replace Photo",
            icon: <ImagePlus className="h-4 w-4" />,
            disabled: isBusy,
            onClick: () => fileInputRef.current?.click(),
          }}
        />
      )}
      {error && (
        <div className="mt-1 text-xs font-medium text-red-300" role="alert">
          {error}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={`Edit image for ${entry.bottle.fullName}`}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) {
            setImageOpen(false);
            void replaceImage(file);
          }
        }}
      />
    </div>
  );
}

export function LibraryEntryStatus({ entry }: { entry: CollectionBottle }) {
  return <CollectionBottleStatusLabel status={entry.status} />;
}

function LibraryEntryStatusMenu({
  value,
  disabled,
  onChange,
}: {
  value: CollectionBottle["status"];
  disabled: boolean;
  onChange: (status: CollectionBottleStatus) => void;
}) {
  const currentMeta = value ? COLLECTION_BOTTLE_STATUS_META[value] : null;
  const label = currentMeta?.label ?? "Not set";

  return (
    <Menu as="div" className="menu inline-block">
      <MenuButton
        type="button"
        disabled={disabled}
        aria-label={`Change bottle status, current status ${label}`}
        className={classNames(
          "inline-flex h-7 items-center gap-1 rounded border px-2 text-xs font-semibold transition-colors disabled:cursor-auto disabled:opacity-70",
          currentMeta
            ? currentMeta.labelClassName
            : "border-slate-700 bg-slate-900 text-slate-300",
        )}
      >
        {label}
        <ChevronDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </MenuButton>
      <MenuItems
        className="absolute right-0 z-40 mt-1 w-36 origin-top-right rounded"
        unmount={false}
      >
        {COLLECTION_BOTTLE_STATUS_VALUES.map((status) => {
          const meta = COLLECTION_BOTTLE_STATUS_META[status];
          const selected = value === status;

          return (
            <MenuItem
              key={status}
              as="button"
              disabled={disabled || selected}
              onClick={() => onChange(status)}
            >
              <span className="inline-flex items-center gap-2">
                <CheckIcon
                  className={classNames(
                    "h-4 w-4",
                    selected ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden="true"
                />
                {meta.label}
              </span>
            </MenuItem>
          );
        })}
      </MenuItems>
    </Menu>
  );
}

export default function LibraryEntryActions({
  entry,
  username,
}: {
  entry: CollectionBottle;
  username: string;
}) {
  const {
    error,
    fileInputRef,
    isBusy,
    removeFromLibrary,
    replaceImage,
    updateStatus,
  } = useLibraryEntryMutations({
    entry,
    username,
  });

  return (
    <div className="min-w-0 shrink-0">
      <div className="flex items-start justify-end gap-2">
        <LibraryEntryStatusMenu
          value={entry.status ?? null}
          disabled={isBusy}
          onChange={(status: CollectionBottleStatus) =>
            void updateStatus(status)
          }
        />
        <Menu as="div" className="menu">
          <MenuButton as={Button} size="small" title="Bottle options">
            <EllipsisVerticalIcon className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Bottle options</span>
          </MenuButton>
          <MenuItems
            className="absolute right-0 z-40 mt-2 w-44 origin-top-right"
            unmount={false}
          >
            <MenuItem
              as="button"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              Edit Image
            </MenuItem>
            <MenuItem
              as="button"
              disabled={isBusy || !entry.status}
              onClick={() => void updateStatus(null)}
            >
              Clear Status
            </MenuItem>
            <MenuItem
              as="button"
              disabled={isBusy}
              onClick={() => void removeFromLibrary()}
            >
              Remove from Library
            </MenuItem>
          </MenuItems>
        </Menu>
      </div>
      {error && (
        <div
          className="mt-1 text-right text-xs font-medium text-red-300"
          role="alert"
        >
          {error}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={`Edit image for ${entry.bottle.fullName}`}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void replaceImage(file);
        }}
      />
    </div>
  );
}
