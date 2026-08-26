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
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useQuery } from "@tanstack/react-query";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { mergeCreateBottleInitialData } from "./createBottleInitialData";

type ReturnAction = "addBottle" | "library" | "tasting" | "view";

interface NameChoice {
  id?: number;
  name: string;
}

function getNameChoice(
  value: string | null,
  id?: number | null,
): NameChoice | undefined {
  const name = value?.trim();
  if (!name) return undefined;
  const choice: NameChoice = { name };
  if (id) choice.id = id;
  return choice;
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
  const distiller =
    prefill.distillers?.length || !prefill.distillerId
      ? null
      : String(prefill.distillerId);
  const distillerName = getNameChoice(
    prefill.distillerName ?? null,
    prefill.distillerId,
  );
  const brand =
    prefill.brandId && !prefill.brandName ? String(prefill.brandId) : null;
  const bottler =
    prefill.bottlerId && !prefill.bottlerName
      ? String(prefill.bottlerId)
      : null;
  const series =
    prefill.seriesId && !prefill.seriesName ? String(prefill.seriesId) : null;
  const brandName = getNameChoice(prefill.brandName ?? null, prefill.brandId);
  const bottlerName = getNameChoice(
    prefill.bottlerName ?? null,
    prefill.bottlerId,
  );
  const seriesName = getNameChoice(
    prefill.seriesName ?? null,
    prefill.seriesId,
  );
  const statedAge = prefill.statedAge ?? null;
  const abv = prefill.abv ?? null;
  const edition = prefill.edition ?? null;
  const vintageYear = prefill.vintageYear ?? null;
  const releaseYear = prefill.releaseYear ?? null;
  const category = prefill.category ?? null;
  const canReviewProposal = !!(user?.mod || user?.admin);

  if (proposalId && user && !canReviewProposal) {
    redirect("/errors/unauthorized");
  }

  const needsToLoad = Boolean(
    distiller || brand || bottler || series || proposalId,
  );
  const [loading, setLoading] = useState<boolean>(needsToLoad);

  const initialFormData: BottleFormInitialData = { name };
  if (pendingImageUrl) initialFormData.imageUrl = pendingImageUrl;
  if (brandName) initialFormData.brand = brandName;
  if (prefill.distillers?.length) {
    initialFormData.distillers = prefill.distillers;
  } else if (distillerName) {
    initialFormData.distillers = [distillerName];
  }
  if (bottlerName) initialFormData.bottler = bottlerName;
  if (seriesName) initialFormData.series = seriesName;
  if (category) initialFormData.category = category;
  if (statedAge !== null) initialFormData.statedAge = statedAge;
  if (abv !== null) initialFormData.abv = abv;
  if (edition) initialFormData.edition = edition;
  if (vintageYear !== null) initialFormData.vintageYear = vintageYear;
  if (releaseYear !== null) initialFormData.releaseYear = releaseYear;
  if (prefill.caskStrength !== null && prefill.caskStrength !== undefined) {
    initialFormData.caskStrength = prefill.caskStrength;
  }
  if (prefill.singleCask !== null && prefill.singleCask !== undefined) {
    initialFormData.singleCask = prefill.singleCask;
  }
  if (prefill.maturation) initialFormData.maturation = prefill.maturation;
  if (prefill.caskNumber) initialFormData.caskNumber = prefill.caskNumber;
  if (prefill.outturn) initialFormData.outturn = prefill.outturn;

  const [initialData, setInitialData] =
    useState<BottleFormInitialData>(initialFormData);

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

  if (loading) {
    return <Spinner />;
  }

  return (
    <BottleForm
      onSubmit={async ({ image, ...data }) => {
        const createdBottle = proposalId
          ? await proposalBottleCreateMutation.mutateAsync({
              proposal: Number(proposalId),
              independentBottle: data,
            })
          : await bottleCreateMutation.mutateAsync(data);
        const nextPendingImageId = image === undefined ? pendingImageId : null;
        const nextPendingImageUrl =
          image === undefined ? pendingImageUrl : null;

        if (image) {
          try {
            const blob = await toBlob(image);
            await bottleImageUpdateMutation.mutateAsync({
              bottle: createdBottle.id,
              file: blob,
            });
          } catch (err) {
            logError(err, {
              context: "bottle_create_image_upload",
              extra: {
                bottleId: createdBottle.id,
              },
            });
            flash(
              "There was an error uploading your image, but the bottle was saved.",
              "error",
            );
          }
        }

        if (returnAction === "library") {
          try {
            await libraryCreateMutation.mutateAsync({
              bottle: createdBottle.id,
              user: "me",
              collection: "library",
              pendingImageId: nextPendingImageId ?? undefined,
            });
          } catch (err) {
            logError(err, {
              context: "bottle_create_library_add",
              extra: {
                bottleId: createdBottle.id,
              },
            });
            flash(
              "The bottle was created, but it could not be added to your Library.",
              "error",
            );
          }
          router.replace(
            getAddBottleHref({
              bottleId: createdBottle.id,
              pendingImageId: nextPendingImageId,
              pendingImageUrl: nextPendingImageUrl,
              resultSource: "created",
              intent: "library",
            }),
          );
        } else if (returnAction === "view") {
          router.replace(`/bottles/${createdBottle.id}`);
        } else if (returnAction === "addBottle") {
          router.replace(
            getAddBottleHref({
              bottleId: createdBottle.id,
              pendingImageId: nextPendingImageId,
              pendingImageUrl: nextPendingImageUrl,
              resultSource: "created",
            }),
          );
        } else if (returnAction === "tasting") {
          router.replace(
            getAddBottleHref({
              bottleId: createdBottle.id,
              pendingImageId: nextPendingImageId,
              pendingImageUrl: nextPendingImageUrl,
              resultSource: "created",
              intent: "tasting",
            }),
          );
        } else if (returnTo) {
          router.push(returnTo);
        } else {
          router.replace(
            getAddBottleHref({
              bottleId: createdBottle.id,
              resultSource: "created",
              intent: "tasting",
            }),
          );
        }
      }}
      initialData={initialData}
      title="Add Bottle"
      saveLabel="Add Bottle"
      returnTo={returnTo}
    />
  );
}
