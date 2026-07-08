"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import BottleForm, {
  type BottleFormInitialData,
} from "@peated/web/components/bottleForm";
import { useFlashMessages } from "@peated/web/components/flash";
import Spinner from "@peated/web/components/spinner";
import useAuth from "@peated/web/hooks/useAuth";
import { VerifiedRequired } from "@peated/web/hooks/useAuthRequired";
import { getAddBottleHref } from "@peated/web/lib/addBottle";
import { toBlob } from "@peated/web/lib/blobs";
import {
  getBottleBottlingPath,
  getNewBottleBottlingPath,
} from "@peated/web/lib/bottlings";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useQuery } from "@tanstack/react-query";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type ReturnAction = "addBottle" | "library" | "tasting" | "view";

function parseDecimalParam(value: string | null, min: number, max: number) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null;
}

function parseIntegerParam(value: string | null, min: number, max: number) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null;
}

function getNameChoice(value: string | null) {
  const name = value?.trim();
  return name ? { name } : undefined;
}

function getReturnAction(value: string | null): ReturnAction | null {
  if (value === "addBottle" || value === "choose") {
    return "addBottle";
  }
  if (value === "library" || value === "tasting" || value === "view") {
    return value;
  }
  return null;
}

export default function CreateBottle() {
  return (
    <VerifiedRequired>
      <CreateBottleForm />
    </VerifiedRequired>
  );
}

function CreateBottleForm() {
  const { user } = useAuth();
  const router = useRouter();
  const orpc = useORPC();
  const searchParams = useSearchParams();
  const name = toTitleCase(searchParams.get("name") || "");
  const returnTo = searchParams.get("returnTo");
  const returnAction = getReturnAction(
    searchParams.get("returnAction") || searchParams.get("intent"),
  );
  const proposalId = searchParams.get("proposal");
  const pendingImageId = searchParams.get("pendingImageId")?.trim() || null;
  const pendingImageUrl = searchParams.get("pendingImageUrl") || null;

  const distiller = searchParams.get("distiller") || null;
  const brand = searchParams.get("brand") || null;
  const bottler = searchParams.get("bottler") || null;
  const series = searchParams.get("series") || null;
  const brandName = getNameChoice(searchParams.get("brandName"));
  const currentYear = new Date().getFullYear();
  const statedAge = parseIntegerParam(searchParams.get("statedAge"), 0, 100);
  const abv = parseDecimalParam(searchParams.get("abv"), 0, 100);
  const edition = searchParams.get("edition")?.trim() || null;
  const vintageYear = parseIntegerParam(
    searchParams.get("vintageYear"),
    1800,
    currentYear,
  );
  const releaseYear = parseIntegerParam(
    searchParams.get("releaseYear"),
    1800,
    currentYear,
  );
  const showBottleReleaseDetails = Boolean(
    edition || abv !== null || vintageYear !== null || releaseYear !== null,
  );
  const canReviewProposal = !!(user?.mod || user?.admin);

  if (proposalId && user && !canReviewProposal) {
    redirect("/errors/unauthorized");
  }

  const needsToLoad = Boolean(
    distiller || brand || bottler || series || proposalId,
  );
  const [loading, setLoading] = useState<boolean>(needsToLoad);

  const [initialData, setInitialData] = useState<BottleFormInitialData>({
    name,
    ...(pendingImageUrl ? { imageUrl: pendingImageUrl } : {}),
    ...(brandName ? { brand: brandName } : {}),
    ...(statedAge !== null ? { statedAge } : {}),
    ...(abv !== null ? { abv } : {}),
    ...(edition ? { edition } : {}),
    ...(vintageYear !== null ? { vintageYear } : {}),
    ...(releaseYear !== null ? { releaseYear } : {}),
  });

  const distillerQuery = useQuery({
    ...orpc.entities.details.queryOptions({
      input: { entity: Number(distiller) },
    }),
    enabled: !!distiller,
  });
  const brandQuery = useQuery({
    ...orpc.entities.details.queryOptions({
      input: { entity: Number(brand) },
    }),
    enabled: !!brand,
  });
  const bottlerQuery = useQuery({
    ...orpc.entities.details.queryOptions({
      input: { entity: Number(bottler) },
    }),
    enabled: !!bottler,
  });
  const seriesQuery = useQuery({
    ...orpc.bottleSeries.details.queryOptions({
      input: { series: Number(series) },
    }),
    enabled: !!series,
  });
  const proposalQuery = useQuery({
    ...orpc.prices.matchQueue.details.queryOptions({
      input: { proposal: Number(proposalId) },
    }),
    enabled: !!proposalId && canReviewProposal,
  });

  useEffect(() => {
    if (
      loading &&
      !distillerQuery.isLoading &&
      !brandQuery.isLoading &&
      !bottlerQuery.isLoading &&
      !seriesQuery.isLoading &&
      (!proposalId || !proposalQuery.isLoading)
    ) {
      const proposalData = proposalQuery.data?.proposedBottle;
      setInitialData((initialData) => ({
        ...initialData,
        ...(proposalData || {}),
        name: proposalData?.name || initialData.name,
        imageUrl: proposalQuery.data?.price.imageUrl || initialData.imageUrl,
        distillers: distillerQuery.data
          ? [distillerQuery.data]
          : proposalData?.distillers || [],
        brand: brandQuery.data || proposalData?.brand,
        bottler: bottlerQuery.data || proposalData?.bottler,
        series: seriesQuery.data || proposalData?.series,
      }));
      setLoading(false);
    }
  }, [
    loading,
    proposalId,
    proposalQuery.isLoading,
    proposalQuery.data,
    distillerQuery.isLoading,
    distillerQuery.data,
    brandQuery.isLoading,
    brandQuery.data,
    bottlerQuery.isLoading,
    bottlerQuery.data,
    seriesQuery.isLoading,
    seriesQuery.data,
  ]);

  const bottleCreateMutation = useMutation(
    orpc.bottles.create.mutationOptions(),
  );
  const proposalBottleCreateMutation = useMutation(
    orpc.prices.matchQueue.createBottle.mutationOptions(),
  );
  const bottleImageUpdateMutation = useMutation(
    orpc.bottles.imageUpdate.mutationOptions(),
  );
  const libraryCreateMutation = useMutation(
    orpc.collections.bottles.create.mutationOptions(),
  );
  const { flash } = useFlashMessages();

  if (
    proposalId &&
    proposalQuery.data?.creationTarget === "release" &&
    proposalQuery.data.parentBottle
  ) {
    redirect(
      `${getNewBottleBottlingPath(proposalQuery.data.parentBottle.id)}?proposal=${proposalId}&returnTo=${encodeURIComponent(returnTo || "/admin/queue")}`,
    );
  }

  if (loading) {
    return <Spinner />;
  }

  return (
    <BottleForm
      onSubmit={async ({ image, ...data }) => {
        const created = proposalId
          ? await proposalBottleCreateMutation.mutateAsync({
              proposal: Number(proposalId),
              bottle: data,
              release:
                proposalQuery.data?.creationTarget === "bottle_and_release"
                  ? proposalQuery.data.proposedRelease || undefined
                  : undefined,
            })
          : await bottleCreateMutation.mutateAsync(data);
        const createdBottle = "bottle" in created ? created.bottle : created;
        const createdRelease = "release" in created ? created.release : null;
        const nextPendingImageId = image === undefined ? pendingImageId : null;
        const nextPendingImageUrl =
          image === undefined ? pendingImageUrl : null;

        if (image) {
          const blob = await toBlob(image);
          try {
            await bottleImageUpdateMutation.mutateAsync({
              bottle: createdBottle.id,
              file: blob,
            });
          } catch (err) {
            logError(err);
            flash(
              "There was an error uploading your image, but the bottle was saved.",
              "error",
            );
          }
        }

        if (returnAction === "library") {
          await libraryCreateMutation.mutateAsync({
            bottle: createdBottle.id,
            release: createdRelease?.id ?? null,
            user: "me",
            collection: "library",
            pendingImageId: nextPendingImageId ?? undefined,
          });
          router.replace(
            getAddBottleHref({
              bottleId: createdBottle.id,
              releaseId: createdRelease?.id ?? null,
              pendingImageId: nextPendingImageId,
              pendingImageUrl: nextPendingImageUrl,
              intent: "library",
            }),
          );
        } else if (returnAction === "view") {
          router.replace(
            createdRelease
              ? getBottleBottlingPath(createdBottle.id, createdRelease.id)
              : `/bottles/${createdBottle.id}`,
          );
        } else if (returnAction === "addBottle") {
          router.replace(
            getAddBottleHref({
              bottleId: createdBottle.id,
              releaseId: createdRelease?.id ?? null,
              pendingImageId: nextPendingImageId,
              pendingImageUrl: nextPendingImageUrl,
            }),
          );
        } else if (returnAction === "tasting") {
          router.replace(
            getAddBottleHref({
              bottleId: createdBottle.id,
              releaseId: createdRelease?.id ?? null,
              pendingImageId: nextPendingImageId,
              pendingImageUrl: nextPendingImageUrl,
              intent: "tasting",
            }),
          );
        } else if (returnTo) {
          router.push(returnTo);
        } else {
          router.replace(
            getAddBottleHref({
              bottleId: createdBottle.id,
              releaseId: createdRelease?.id ?? null,
              intent: "tasting",
            }),
          );
        }
      }}
      initialData={initialData}
      title="Create Bottle"
      saveLabel="Create Bottle"
      returnTo={returnTo}
      showBottleReleaseDetails={showBottleReleaseDetails}
    />
  );
}
