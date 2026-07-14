"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import BottleForm, {
  type BottleFormInitialData,
} from "@peated/web/components/bottleForm";
import { useFlashMessages } from "@peated/web/components/flash";
import { parseCreateBottlePrefill } from "@peated/web/components/search/createBottleHref";
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
import { mergeCreateBottleInitialData } from "./createBottleInitialData";

type ReturnAction = "addBottle" | "library" | "tasting" | "view";

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

  const prefill = parseCreateBottlePrefill(searchParams);
  const distiller = prefill.distillerId ? String(prefill.distillerId) : null;
  const distillerName = getNameChoice(prefill.distillerName ?? null);
  const brand = prefill.brandId ? String(prefill.brandId) : null;
  const bottler = searchParams.get("bottler") || null;
  const series = searchParams.get("series") || null;
  const brandName = getNameChoice(prefill.brandName ?? null);
  const statedAge = prefill.statedAge ?? null;
  const abv = prefill.abv ?? null;
  const edition = prefill.edition ?? null;
  const vintageYear = prefill.vintageYear ?? null;
  const releaseYear = prefill.releaseYear ?? null;
  const category = prefill.category ?? null;
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
    ...(distillerName ? { distillers: [distillerName] } : {}),
    ...(category ? { category } : {}),
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
      setInitialData((initialData) =>
        mergeCreateBottleInitialData({
          initialData,
          proposalData,
          proposalImageUrl: proposalQuery.data?.price.imageUrl,
          distiller: distillerQuery.data,
          brand: brandQuery.data,
          bottler: bottlerQuery.data,
          series: seriesQuery.data,
        }),
      );
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
