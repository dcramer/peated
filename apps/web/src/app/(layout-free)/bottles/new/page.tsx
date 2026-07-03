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
import { getNewBottleBottlingPath } from "@peated/web/lib/bottlings";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useQuery } from "@tanstack/react-query";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type ReturnAction = "addBottle" | "library" | "tasting" | "view";

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

  const distiller = searchParams.get("distiller") || null;
  const brand = searchParams.get("brand") || null;
  const bottler = searchParams.get("bottler") || null;
  const series = searchParams.get("series") || null;
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
            user: "me",
            collection: "library",
          });
          router.replace(
            user?.username ? `/users/${user.username}/library` : "/bottles",
          );
        } else if (returnAction === "view") {
          router.replace(`/bottles/${createdBottle.id}`);
        } else if (returnAction === "addBottle") {
          router.replace("/addBottle");
        } else if (returnAction === "tasting") {
          router.replace(
            getAddBottleHref({
              bottleId: createdBottle.id,
              intent: "tasting",
            }),
          );
        } else if (returnTo) {
          router.push(returnTo);
        } else {
          router.replace(
            getAddBottleHref({
              bottleId: createdBottle.id,
              intent: "tasting",
            }),
          );
        }
      }}
      initialData={initialData}
      title="Create Bottle"
      saveLabel="Create Bottle"
      returnTo={returnTo}
    />
  );
}
